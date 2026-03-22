import asyncio
import json
import logging
import os

from src.models.interview import InterviewState, calculate_maturity
from src.services.gemini import analyze_json
from src.services.prompts import STATE_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)

MAX_DELTA_PER_DOMAIN = 2
MAX_TOTAL_DELTA_PER_TURN = 3

# Feature toggle — set STATE_DUAL_PASS=false to disable without redeploy
DUAL_PASS_ENABLED = os.getenv("STATE_DUAL_PASS", "true").lower() == "true"


async def _run_analysis_pass(prompt: str, temperature: float) -> dict[str, object] | None:
    """Run one analysis pass. Returns the parsed dict or None on failure."""
    try:
        return await analyze_json(prompt, temperature=temperature)
    except Exception:
        logger.warning("State analysis pass (temperature=%.1f) failed", temperature, exc_info=True)
        return None


def _merge_passes(
    pass1: dict[str, object],
    pass2: dict[str, object],
) -> dict[str, object]:
    """Merge two analysis passes conservatively.

    - answered_delta: take the minimum (conservative — avoid over-crediting)
    - vital_answered: True only if both passes agree
    - conversation_summary / open_questions / last_questions_asked: use pass 1
      (temperature=0.0 is deterministic, preferred for text fields)
    """
    merged: dict[str, object] = dict(pass1)

    _raw_du1 = pass1.get("domains_update")
    du1: dict[str, object] = _raw_du1 if isinstance(_raw_du1, dict) else {}
    _raw_du2 = pass2.get("domains_update")
    du2: dict[str, object] = _raw_du2 if isinstance(_raw_du2, dict) else {}

    merged_domains: dict[str, object] = {}
    all_domains: set[str] = set(du1.keys()) | set(du2.keys())
    for domain in all_domains:
        _raw_d1 = du1.get(domain)
        d1: dict[str, object] = _raw_d1 if isinstance(_raw_d1, dict) else {}
        _raw_d2 = du2.get(domain)
        d2: dict[str, object] = _raw_d2 if isinstance(_raw_d2, dict) else {}

        _d1_delta = d1.get("answered_delta", 0)
        delta1 = int(_d1_delta) if isinstance(_d1_delta, (int, float)) else 0
        _d2_delta = d2.get("answered_delta", 0)
        delta2 = int(_d2_delta) if isinstance(_d2_delta, (int, float)) else 0
        final_delta = min(delta1, delta2)

        vital1 = bool(d1.get("vital_answered", False))
        vital2 = bool(d2.get("vital_answered", False))
        final_vital = vital1 and vital2

        if delta1 != delta2 or vital1 != vital2:
            logger.info(
                "dual_pass_divergence",
                extra={
                    "domain": domain,
                    "pass1_delta": delta1,
                    "pass2_delta": delta2,
                    "accepted_delta": final_delta,
                    "pass1_vital": vital1,
                    "pass2_vital": vital2,
                    "accepted_vital": final_vital,
                },
            )

        merged_domains[domain] = {
            "answered_delta": final_delta,
            "vital_answered": final_vital,
        }

    merged["domains_update"] = merged_domains
    return merged


async def analyze_and_update_state(
    current_state: InterviewState,
    user_message: str,
    ai_response: str,
) -> tuple[InterviewState, float]:
    current_domains_str = json.dumps(
        {k: v.model_dump() for k, v in current_state.domains.items()},
        indent=2,
    )

    # Usar replace() em vez de .format() para evitar conflito com as chaves {}
    # do exemplo JSON no corpo do prompt.
    prompt = (
        STATE_ANALYSIS_PROMPT.replace("{user_message}", user_message)
        .replace("{ai_response}", ai_response)
        .replace("{current_domains}", current_domains_str)
    )

    try:
        if DUAL_PASS_ENABLED:
            # Run two passes in parallel: temp=0.0 (deterministic) and 0.3 (slight variation)
            result1, result2 = await asyncio.gather(
                _run_analysis_pass(prompt, temperature=0.0),
                _run_analysis_pass(prompt, temperature=0.3),
            )
            if result1 is not None and result2 is not None:
                analysis = _merge_passes(result1, result2)
            elif result1 is not None:
                analysis = result1
            elif result2 is not None:
                analysis = result2
            else:
                raise RuntimeError("Both dual-pass analysis attempts failed")
        else:
            analysis = await analyze_json(prompt)
    except Exception:
        logger.warning(
            "State analysis failed for interview — keeping current state. Prompt length: %d chars",
            len(prompt),
        )
        logger.exception("State analysis exception details")
        return current_state, calculate_maturity(current_state)

    if not isinstance(analysis, dict):
        logger.warning(
            "State analysis returned non-dict response: %s",
            repr(analysis)[:500],
        )
        return current_state, calculate_maturity(current_state)

    domains_upd = analysis.get("domains_update")
    domain_keys = list(domains_upd.keys()) if isinstance(domains_upd, dict) else "none"
    logger.info("State analysis completed — domains_update keys: %s", domain_keys)

    updated = current_state.model_copy(deep=True)

    domains_update = analysis.get("domains_update", {})
    if isinstance(domains_update, dict):
        # Sanity check: reject entire analysis if total delta is suspiciously high
        raw_deltas = {
            domain: int(delta.get("answered_delta", 0))
            for domain, delta in domains_update.items()
            if isinstance(delta, dict)
        }
        total_delta = sum(max(v, 0) for v in raw_deltas.values())
        if total_delta > MAX_TOTAL_DELTA_PER_TURN:
            logger.error(
                "State analysis rejected: total answered_delta=%d exceeds limit=%d "
                "(per_domain=%s) — keeping current state",
                total_delta,
                MAX_TOTAL_DELTA_PER_TURN,
                raw_deltas,
            )
            return current_state, calculate_maturity(current_state)

        for domain, delta in domains_update.items():
            if domain in updated.domains and isinstance(delta, dict):
                d = updated.domains[domain]
                answered_delta = int(delta.get("answered_delta", 0))

                # NEVER_DECREASE: clamp negatives to 0
                if answered_delta < 0:
                    logger.warning(
                        "State analysis: negative answered_delta=%d for domain '%s' — clamped to 0",
                        answered_delta,
                        domain,
                    )
                    answered_delta = 0

                # Per-domain cap
                if answered_delta > MAX_DELTA_PER_DOMAIN:
                    logger.warning(
                        "State analysis: answered_delta=%d for domain '%s' "
                        "exceeds MAX_DELTA_PER_DOMAIN=%d — clamped",
                        answered_delta,
                        domain,
                        MAX_DELTA_PER_DOMAIN,
                    )
                    answered_delta = MAX_DELTA_PER_DOMAIN

                d.answered = min(d.answered + answered_delta, d.total)

                # vital_answered is one-way: once True, never revert
                if delta.get("vital_answered"):
                    d.vital_answered = True
                elif d.vital_answered:
                    logger.warning(
                        "State analysis: LLM returned vital_answered=False for domain '%s' "
                        "that was already True — ignored",
                        domain,
                    )

    summary = analysis.get("conversation_summary")
    if isinstance(summary, str) and summary:
        updated.conversation_summary = summary

    open_q = analysis.get("open_questions")
    if isinstance(open_q, list):
        updated.open_questions = [str(q) for q in open_q]

    last_q = analysis.get("last_questions_asked")
    if isinstance(last_q, list):
        updated.last_questions_asked = [str(q) for q in last_q]

    maturity = calculate_maturity(updated)
    return updated, maturity
