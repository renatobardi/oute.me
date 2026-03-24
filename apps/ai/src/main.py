import json
import logging
import os
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import vertexai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.middleware import (
    RateLimitMiddleware,
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
)
from src.routers import admin, chat, estimate, health, knowledge
from src.services.database import close_pool, get_pool


def _configure_logging() -> None:
    """JSON estruturado em produção (Cloud Logging parseia automaticamente).
    Texto legível em desenvolvimento.
    """
    if settings.environment == "production":

        class _JsonFormatter(logging.Formatter):
            def format(self, record: logging.LogRecord) -> str:
                entry: dict[str, object] = {
                    "severity": record.levelname,
                    "message": record.getMessage(),
                    "logger": record.name,
                }
                if record.exc_info:
                    entry["exception"] = self.formatException(record.exc_info)
                if hasattr(record, "__dict__"):
                    for k, v in record.__dict__.items():
                        if k not in (
                            "name",
                            "msg",
                            "args",
                            "levelname",
                            "levelno",
                            "pathname",
                            "filename",
                            "module",
                            "exc_info",
                            "exc_text",
                            "stack_info",
                            "lineno",
                            "funcName",
                            "created",
                            "msecs",
                            "relativeCreated",
                            "thread",
                            "threadName",
                            "processName",
                            "process",
                            "message",
                        ):
                            entry[k] = v
                return json.dumps(entry, ensure_ascii=False, default=str)

        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JsonFormatter())
        logging.root.handlers = [handler]
        logging.root.setLevel(logging.INFO)
    else:
        logging.basicConfig(
            level=logging.DEBUG,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )


_configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    # Validar conectividade com o banco no startup
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        logger.info("Database connectivity OK")
    except Exception as e:
        logger.error("Database connectivity FAILED: %s", e)
        # Não abortar — permite health check retornar status degradado

    # Inicializa Vertex AI com ADC (Application Default Credentials)
    vertexai.init(project=settings.gcp_project, location=settings.gcp_location)

    # LiteLLM (usado pelo CrewAI) precisa destas env vars para vertex_ai/ prefix
    os.environ.setdefault("VERTEXAI_PROJECT", settings.gcp_project)
    os.environ.setdefault("VERTEXAI_LOCATION", settings.gcp_location)

    logger.info(
        "Vertex AI inicializado",
        extra={"gcp_project": settings.gcp_project, "gcp_location": settings.gcp_location},
    )
    yield
    await close_pool()


app = FastAPI(
    title="oute.me AI Service",
    description="Internal AI service for oute.me",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# Middleware (order matters: last added = first executed)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://oute.me",
        "https://oute.pro",
        "https://dev.oute.pro",
        "http://localhost:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    max_age=3600,
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(estimate.router, prefix="/estimate", tags=["estimate"])
app.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "oute-ai", "status": "ok"}
