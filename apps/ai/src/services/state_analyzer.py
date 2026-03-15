import json
import logging

from src.models.interview import InterviewState, calculate_maturity
from src.services.gemini import analyze_json
from src.services.prompts import STATE_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)


async def analyze_and_update_state(
    current_state: InterviewState,
    user_message: str,
    ai_response: str,
) -> tuple[InterviewState, float]:
    current_domains_str = json.dumps(
        {k: v.model_dump() for k, v in current_state.domains.items()},
        indent=2,
    )

    prompt = STATE_ANALYSIS_PROMPT.format(
        user_message=user_message,
        ai_response=ai_response,
        current_domains=current_domains_str,
    )

    try:
        analysis = await analyze_json(prompt)
    except Exception:
        logger.warning(
            "State analysis failed for interview — keeping current state. "
            "Prompt length: %d chars",
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

    logger.info(
        "State analysis completed — domains_update keys: %s",
        list(analysis.get("domains_update", {}).keys()) if isinstance(analysis.get("domains_update"), dict) else "none",
    )

    updated = current_state.model_copy(deep=True)

    domains_update = analysis.get("domains_update", {})
    if isinstance(domains_update, dict):
        for domain, delta in domains_update.items():
            if domain in updated.domains and isinstance(delta, dict):
                d = updated.domains[domain]
                answered_delta = int(delta.get("answered_delta", 0))
                d.answered = min(d.answered + answered_delta, d.total)
                if delta.get("vital_answered"):
                    d.vital_answered = True

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
