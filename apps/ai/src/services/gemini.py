import asyncio
import json
from collections.abc import AsyncGenerator

from google import genai
from google.genai.types import Content, GenerateContentConfig, Part

from src.config import settings

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


MODEL = "gemini-2.5-flash"


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

    stream = await client.aio.models.generate_content_stream(
        model=MODEL,
        contents=contents,  # type: ignore[arg-type]
        config=config,
    )
    async for chunk in stream:
        if asyncio.get_event_loop().time() > deadline:
            raise TimeoutError(f"Gemini stream_chat exceeded {max_seconds}s timeout")
        if chunk.text:
            yield chunk.text


async def analyze_json(prompt: str, max_seconds: float = 30.0) -> dict[str, object]:
    client = _get_client()

    config = GenerateContentConfig(
        response_mime_type="application/json",
    )

    response = await asyncio.wait_for(
        client.aio.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=config,
        ),
        timeout=max_seconds,
    )
    return json.loads(response.text or "{}")  # type: ignore[no-any-return]
