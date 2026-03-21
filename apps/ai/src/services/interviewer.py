"""
interviewer.py
==============
Agente conversacional da entrevista de descoberta.
Atualização Phase 2: adiciona inicialização de domínios antes de processar.

MUDANÇAS EM RELAÇÃO AO ORIGINAL:
  1. Chama ensure_domains_initialized() antes de build_system_prompt()
     → Fix crítico: sem isso, calculate_maturity() retorna 0 sempre
  2. Passa progress summary para build_system_prompt() via campo dedicado
     → O prompt agora sabe quantos domínios faltam com precisão
  3. Loga uncovered vital domains a cada turno para diagnóstico

SSE EVENT ORDER (não alterar — o frontend depende desta ordem):
  1. message_chunk  (N vezes, 1 por chunk de texto)
  2. done           (1 vez, quando streaming termina)
  3. state_update   (1 vez, após análise assíncrona de estado)
"""

import json
import logging
import uuid
from collections.abc import AsyncGenerator

from src.models.interview import ChatRequest
from src.services.interview_initializer import (
    ensure_domains_initialized,
    get_uncovered_vital_domains,
)
from src.services.llm import analyze_json, stream_chat
from src.services.prompts import build_system_prompt
from src.services.state_analyzer import analyze_and_update_state

logger = logging.getLogger(__name__)


async def _suggest_title(
    user_message: str,
    llm_model: str,
    history: list[dict[str, str]] | None = None,
) -> str | None:
    """Generate a short project name from the conversation context."""
    user_messages = [m["content"] for m in (history or []) if m.get("role") == "user"]
    if user_message not in user_messages:
        user_messages.append(user_message)
    context = "\n".join(f"- {m}" for m in user_messages[-5:])
    prompt = (
        "Based on the user messages below from a software project scoping conversation, "
        "generate a short and representative project name (2 to 5 words). "
        "Use the same language as the messages. "
        "Respond ONLY with valid JSON in the format: {\"title\": \"Project Name\"}\n\n"
        f"User messages:\n{context}"
    )
    try:
        result = await analyze_json(prompt, llm_model=llm_model, max_seconds=15.0)
        title = result.get("title")
        if isinstance(title, str) and title.strip():
            return title.strip()
    except Exception:
        logger.warning("Failed to generate suggested title", exc_info=True)
    return None


async def process_message(
    request: ChatRequest,
) -> AsyncGenerator[dict[str, str], None]:
    # --- Phase 2 fix: garantir que domínios estejam inicializados ---
    # Idempotente — seguro chamar a cada turno.
    # Sem isso, calculate_maturity() divide por total=0 e retorna 0 sempre.
    initialized_state = ensure_domains_initialized(request.state)

    uncovered_vitals = get_uncovered_vital_domains(initialized_state)
    if uncovered_vitals:
        logger.debug(
            "Interview %s — vital domains not yet covered: %s",
            request.interview_id,
            uncovered_vitals,
        )

    system_prompt = build_system_prompt(
        initialized_state,
        request.documents_context,
        request.tone_instruction,
    )

    history = [{"role": msg.role, "content": msg.content} for msg in request.history]

    full_response = ""
    tokens_used = 0

    try:
        async for chunk in await stream_chat(
            system_prompt, history, request.user_message, llm_model=request.llm_model
        ):
            full_response += chunk
            tokens_used += len(chunk.split())
            yield _sse_event(
                "message_chunk",
                {
                    "text": chunk,
                    "interview_id": request.interview_id,
                },
            )
    except Exception:
        logger.exception("stream_chat failed for interview %s", request.interview_id)
        yield _sse_event(
            "error",
            {"message": "O serviço de IA está temporariamente indisponível. Tente novamente em instantes."},  # noqa: E501
        )
        return

    # Emite done ANTES da análise de estado — usuário vê resposta completa imediatamente
    yield _sse_event(
        "done",
        {
            "message_id": str(uuid.uuid4()),
            "tokens_used": tokens_used,
            "full_response": full_response,
        },
    )

    # Conta quantas mensagens do usuário já existem no histórico (excluindo a atual)
    user_turns = sum(1 for m in request.history if m.role == "user")

    # Análise de estado e title suggestion em paralelo
    state_task = analyze_and_update_state(
        initialized_state,
        request.user_message,
        full_response,
    )

    should_suggest_title = user_turns <= 5 and request.current_title is None
    title_task = (
        _suggest_title(request.user_message, request.llm_model, history)
        if should_suggest_title
        else None
    )

    if title_task is not None:
        import asyncio
        (updated_state, maturity), suggested_title = await asyncio.gather(
            state_task, title_task
        )
    else:
        updated_state, maturity = await state_task
        suggested_title = None

    logger.info(
        "Interview %s — maturity: %.3f | vitals uncovered: %s",
        request.interview_id,
        maturity,
        get_uncovered_vital_domains(updated_state),
    )

    state_update_data: dict[str, object] = {
        "maturity": maturity,
        "domains": {k: v.model_dump() for k, v in updated_state.domains.items()},
        "open_questions": updated_state.open_questions,
        "state": updated_state.model_dump(),
    }
    if suggested_title:
        state_update_data["suggested_title"] = suggested_title

    yield _sse_event("state_update", state_update_data)


def _sse_event(event: str, data: dict[str, object]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}
