import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable
from vertexai.generative_models import Content, GenerationConfig, GenerativeModel, Part

logger = logging.getLogger(__name__)

# Vertex AI é inicializado uma vez em main.py via vertexai.init()

# Fallback chain: primary first, then alternatives ordered by capability/availability
CHAT_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

_RETRYABLE_EXCEPTIONS = (ServiceUnavailable, ResourceExhausted)


async def stream_chat(
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
    max_seconds: float = 120.0,
) -> AsyncGenerator[str, None]:
    contents: list[Content] = []
    for entry in history:
        role = "model" if entry["role"] == "assistant" else "user"
        contents.append(Content(role=role, parts=[Part.from_text(entry["content"])]))
    contents.append(Content(role="user", parts=[Part.from_text(user_message)]))

    generation_config = GenerationConfig(
        temperature=0.7,
        max_output_tokens=1024,
    )

    deadline = asyncio.get_event_loop().time() + max_seconds
    last_exc: Exception | None = None

    for i, model_name in enumerate(CHAT_MODELS):
        try:
            model = GenerativeModel(
                model_name,
                generation_config=generation_config,
                system_instruction=system_prompt,
            )
            stream = await model.generate_content_async(
                contents,
                stream=True,
            )
            async for chunk in stream:
                if asyncio.get_event_loop().time() > deadline:
                    raise TimeoutError(f"Gemini stream_chat exceeded {max_seconds}s timeout")
                if chunk.text:
                    yield chunk.text
            return  # success — stop trying further models
        except _RETRYABLE_EXCEPTIONS as exc:
            if i == len(CHAT_MODELS) - 1:
                raise
            last_exc = exc
            logger.warning(
                "model %s unavailable (%s), trying %s",
                model_name,
                exc,
                CHAT_MODELS[i + 1],
            )

    if last_exc:
        raise last_exc


async def analyze_json(prompt: str, max_seconds: float = 30.0) -> dict[str, object]:
    generation_config = GenerationConfig(
        response_mime_type="application/json",
    )

    last_exc: Exception | None = None
    for i, model_name in enumerate(CHAT_MODELS):
        try:
            model = GenerativeModel(model_name, generation_config=generation_config)
            response = await asyncio.wait_for(
                model.generate_content_async(prompt),
                timeout=max_seconds,
            )
            return json.loads(response.text or "{}")  # type: ignore[no-any-return]
        except _RETRYABLE_EXCEPTIONS as exc:
            if i == len(CHAT_MODELS) - 1:
                raise
            last_exc = exc
            logger.warning(
                "model %s unavailable (%s), trying %s",
                model_name,
                exc,
                CHAT_MODELS[i + 1],
            )

    if last_exc:
        raise last_exc
    return {}
