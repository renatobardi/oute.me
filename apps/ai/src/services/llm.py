"""
llm.py
======
Roteador de provedores LLM.
Seleciona gemini.py ou grok.py com base no parâmetro llm_model.

Convenção de nomes:
  - "gemini-*"  → Vertex AI (gemini.py)
  - "grok-*"    → xAI (grok.py)
  - qualquer outro → fallback para Gemini
"""

from collections.abc import AsyncGenerator

from src.services import gemini, grok

_DEFAULT_MODEL = "gemini-2.5-flash"


def _is_grok(model: str) -> bool:
    return model.lower().startswith("grok")


async def stream_chat(
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
    llm_model: str = _DEFAULT_MODEL,
    max_seconds: float = 120.0,
) -> AsyncGenerator[str, None]:
    if _is_grok(llm_model):
        return grok.stream_chat(
            system_prompt,
            history,
            user_message,
            model=llm_model,
            max_seconds=max_seconds,
        )
    return gemini.stream_chat(
        system_prompt,
        history,
        user_message,
        max_seconds=max_seconds,
    )


async def analyze_json(
    prompt: str,
    llm_model: str = _DEFAULT_MODEL,
    max_seconds: float = 30.0,
) -> dict[str, object]:
    if _is_grok(llm_model):
        return await grok.analyze_json(prompt, model=llm_model, max_seconds=max_seconds)
    return await gemini.analyze_json(prompt, max_seconds=max_seconds)
