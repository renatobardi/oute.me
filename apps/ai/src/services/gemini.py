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


MODEL = "gemini-2.5-flash-lite"


async def stream_chat(
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
) -> AsyncGenerator[str, None]:
    client = _get_client()

    contents: list[Content] = []
    for entry in history:
        role = "model" if entry["role"] == "assistant" else "user"
        contents.append(Content(role=role, parts=[Part(text=entry["content"])]))
    contents.append(Content(role="user", parts=[Part(text=user_message)]))

    config = GenerateContentConfig(
        system_instruction=system_prompt,
    )

    async for chunk in client.aio.models.generate_content_stream(
        model=MODEL,
        contents=contents,
        config=config,
    ):
        if chunk.text:
            yield chunk.text


async def analyze_json(prompt: str) -> dict[str, object]:
    client = _get_client()

    config = GenerateContentConfig(
        response_mime_type="application/json",
    )

    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=config,
    )
    return json.loads(response.text or "{}")
