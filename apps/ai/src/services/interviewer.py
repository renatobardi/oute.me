import json
import uuid
from collections.abc import AsyncGenerator

from src.models.interview import ChatRequest
from src.services.gemini import stream_chat
from src.services.prompts import build_system_prompt
from src.services.state_analyzer import analyze_and_update_state


async def process_message(
    request: ChatRequest,
) -> AsyncGenerator[dict[str, str], None]:
    system_prompt = build_system_prompt(
        request.state, request.documents_context, request.tone_instruction
    )

    history = [{"role": msg.role, "content": msg.content} for msg in request.history]

    full_response = ""
    tokens_used = 0

    async for chunk in stream_chat(system_prompt, history, request.user_message):
        full_response += chunk
        tokens_used += len(chunk.split())
        yield _sse_event(
            "message_chunk",
            {
                "text": chunk,
                "interview_id": request.interview_id,
            },
        )

    # Emit done BEFORE state analysis so user sees response complete immediately
    yield _sse_event(
        "done",
        {
            "message_id": str(uuid.uuid4()),
            "tokens_used": tokens_used,
            "full_response": full_response,
        },
    )

    updated_state, maturity = await analyze_and_update_state(
        request.state,
        request.user_message,
        full_response,
    )

    yield _sse_event(
        "state_update",
        {
            "maturity": maturity,
            "domains": {k: v.model_dump() for k, v in updated_state.domains.items()},
            "open_questions": updated_state.open_questions,
            "state": updated_state.model_dump(),
        },
    )


def _sse_event(event: str, data: dict[str, object]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}
