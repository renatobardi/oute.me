from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from src.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

_CHANNEL = "admin:pipeline_events"


@router.get("/pipeline-events")
async def pipeline_events(request: Request) -> EventSourceResponse:
    """SSE stream com eventos de pipeline para o admin dashboard.

    Requer Redis configurado (settings.redis_url). Se Redis não estiver
    disponível, mantém a conexão aberta com keepalives.
    """

    async def event_generator() -> AsyncGenerator[dict[str, Any], None]:
        if not settings.redis_url:
            logger.debug("Redis não configurado — SSE admin em modo keepalive")
            while True:
                if await request.is_disconnected():
                    break
                yield {"event": "keepalive", "data": ""}
                import asyncio

                await asyncio.sleep(15)
            return

        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe(_CHANNEL)
        logger.info("Admin SSE: subscribed to %s", _CHANNEL)

        try:
            async for message in pubsub.listen():
                if await request.is_disconnected():
                    break
                if message.get("type") != "message":
                    continue
                try:
                    data = message["data"]
                    payload = json.loads(data) if isinstance(data, str) else data
                    yield {
                        "event": payload.get("type", "pipeline_update"),
                        "data": json.dumps(payload),
                    }
                except Exception:
                    logger.exception("Failed to parse pipeline event message")
        finally:
            await pubsub.unsubscribe(_CHANNEL)
            await r.aclose()
            logger.info("Admin SSE: unsubscribed from %s", _CHANNEL)

    return EventSourceResponse(event_generator())
