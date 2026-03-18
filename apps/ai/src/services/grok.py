"""
grok.py
=======
Cliente para a API da xAI (Grok).
Implementa a mesma interface de stream_chat / analyze_json que gemini.py,
permitindo troca transparente de provedor via llm_model.

Autenticação: GROK_API_KEY (env var / Secret Manager).
Base URL: https://api.x.ai/v1 (compatível com OpenAI)
"""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator

import httpx

from src.config import settings

logger = logging.getLogger(__name__)

_GROK_BASE_URL = "https://api.x.ai/v1"
_DEFAULT_MODEL = "grok-3"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.grok_api_key}",
        "Content-Type": "application/json",
    }


def _build_messages(
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for entry in history:
        messages.append({"role": entry["role"], "content": entry["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


async def stream_chat(
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
    model: str = _DEFAULT_MODEL,
    max_seconds: float = 120.0,
) -> AsyncGenerator[str, None]:
    if not settings.grok_api_key:
        raise RuntimeError("GROK_API_KEY não configurada")

    payload = {
        "model": model,
        "messages": _build_messages(system_prompt, history, user_message),
        "temperature": 0.7,
        "max_tokens": 1024,
        "stream": True,
    }

    deadline = asyncio.get_event_loop().time() + max_seconds

    async with httpx.AsyncClient(timeout=max_seconds) as client:
        async with client.stream(
            "POST",
            f"{_GROK_BASE_URL}/chat/completions",
            headers=_headers(),
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if asyncio.get_event_loop().time() > deadline:
                    raise TimeoutError(f"Grok stream_chat exceeded {max_seconds}s timeout")
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    text = chunk["choices"][0]["delta"].get("content", "")
                    if text:
                        yield text
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue


async def analyze_json(
    prompt: str,
    model: str = _DEFAULT_MODEL,
    max_seconds: float = 30.0,
) -> dict[str, object]:
    if not settings.grok_api_key:
        raise RuntimeError("GROK_API_KEY não configurada")

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=max_seconds) as client:
        response = await client.post(
            f"{_GROK_BASE_URL}/chat/completions",
            headers=_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content or "{}")  # type: ignore[no-any-return]
