import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from google import genai
from google.genai.errors import ServerError
from google.genai.types import Content, GenerateContentConfig, Part

from src.config import settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# Fallback chain: primary first, then alternatives ordered by capability/availability
CHAT_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

_RETRYABLE_CODES = {503, 429}


async def stream_chat(
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
    max_seconds: float = 120.0,
) -> AsyncGenerator[str, None]:
    client = _get_client()

    contents: list[Content] = []
    for entry in history:
        role = "model" if entry["role"] == "assistant" else "user"
        contents.append(Content(role=role, parts=[Part(text=entry["content"])]))
    contents.append(Content(role="user", parts=[Part(text=user_message)]))

    config = GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.7,
        max_output_tokens=1024,
    )

    deadline = asyncio.get_event_loop().time() + max_seconds
    last_exc: Exception | None = None

    for i, model in enumerate(CHAT_MODELS):
        try:
            stream = await client.aio.models.generate_content_stream(
                model=model,
                contents=contents,  # type: ignore[arg-type]
                config=config,
            )
            async for chunk in stream:
                if asyncio.get_event_loop().time() > deadline:
                    raise TimeoutError(f"Gemini stream_chat exceeded {max_seconds}s timeout")
                if chunk.text:
                    yield chunk.text
            return  # success — stop trying further models
        except ServerError as exc:
            if exc.code not in _RETRYABLE_CODES or i == len(CHAT_MODELS) - 1:
                raise
            last_exc = exc
            logger.warning("model %s unavailable (%s), trying %s", model, exc.code, CHAT_MODELS[i + 1])

    if last_exc:
        raise last_exc


async def analyze_json(prompt: str, max_seconds: float = 30.0) -> dict[str, object]:
    client = _get_client()

    config = GenerateContentConfig(
        response_mime_type="application/json",
    )

    last_exc: Exception | None = None
    for i, model in enumerate(CHAT_MODELS):
        try:
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                ),
                timeout=max_seconds,
            )
            return json.loads(response.text or "{}")  # type: ignore[no-any-return]
        except ServerError as exc:
            if exc.code not in _RETRYABLE_CODES or i == len(CHAT_MODELS) - 1:
                raise
            last_exc = exc
            logger.warning("model %s unavailable (%s), trying %s", model, exc.code, CHAT_MODELS[i + 1])

    if last_exc:
        raise last_exc
    return {}
