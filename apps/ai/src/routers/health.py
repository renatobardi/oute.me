import logging

from fastapi import APIRouter

from src.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/services")
async def health_check() -> dict[str, str]:
    statuses: dict[str, str] = {}

    # PostgreSQL
    if settings.database_url:
        try:
            from src.services.database import get_pool

            pool = await get_pool()
            await pool.fetchval("SELECT 1")
            statuses["postgres"] = "ok"
        except Exception:
            logger.exception("PostgreSQL health check failed")
            statuses["postgres"] = "error"
    else:
        statuses["postgres"] = "not_configured"

    # Redis
    if settings.redis_url:
        try:
            import redis.asyncio as aioredis

            r = aioredis.from_url(settings.redis_url, decode_responses=True)
            await r.ping()  # type: ignore[misc]
            await r.aclose()
            statuses["redis"] = "ok"
        except Exception:
            logger.exception("Redis health check failed")
            statuses["redis"] = "error"
    else:
        statuses["redis"] = "not_configured"

    # Vertex AI — autenticação via ADC, sem API key
    try:
        from vertexai.generative_models import GenerativeModel

        GenerativeModel("gemini-2.5-flash")
        statuses["vertex_ai"] = f"ok (project={settings.gcp_project}, location={settings.gcp_location})"
    except Exception:
        logger.exception("Vertex AI health check failed")
        statuses["vertex_ai"] = "error"

    return statuses
