import json
import logging

from src.models.interview import InterviewState, calculate_maturity
from src.services.gemini import analyze_json
from src.services.prompts import STATE_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)

MAX_DELTA_PER_DOMAIN = 2
MAX_TOTAL_DELTA_PER_TURN = 3


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
