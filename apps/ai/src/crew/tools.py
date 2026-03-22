from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

from crewai.tools import BaseTool

logger = logging.getLogger(__name__)


def _run_async_in_sync[T](coro: Coroutine[Any, Any, T]) -> T:
    """Run an async coroutine from CrewAI's sync tool context.

    Since CrewAI tools run inside a ThreadPoolExecutor (separate thread
    from the FastAPI event loop), we can safely create a new event loop.
    """
    try:
        return asyncio.run(coro)
    except Exception:
        logger.exception("Failed to run async coroutine in sync context")
        raise


class VectorSearchTool(BaseTool):
    name: str = "vector_search"
    description: str = (
        "Busca projetos e estimativas similares na base de conhecimento vetorial. "
        "Recebe uma query de texto e retorna os resultados mais relevantes."
    )
    interview_id: str = ""

    def _run(self, query: str) -> str:
        import json

        from src.services.vector_store import search_similar

        exclude_id = self.interview_id or None
        try:
            results: list[dict[str, Any]] = _run_async_in_sync(
                search_similar(query, limit=5, exclude_source_id=exclude_id)
            )
        except Exception:
            logger.exception("Vector search failed for query: %s", query[:100])
            return json.dumps(
                {
                    "results": [],
                    "message": "Erro na busca vetorial. Continuando sem resultados internos.",
                }
            )

        if not results:
            return json.dumps(
                {
                    "results": [],
                    "message": "Nenhum projeto similar encontrado na base de conhecimento.",
                }
            )

        return json.dumps({"results": results}, ensure_ascii=False)


class WebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = (
        "Busca na internet por projetos similares, arquiteturas de referência, "
        "benchmarks de custo e artigos técnicos. Recebe uma query de busca "
        "e retorna os resultados mais relevantes da web."
    )

    def _run(self, query: str) -> str:
        import json

        from src.services.web_search import search_web

        try:
            results: list[dict[str, str]] = _run_async_in_sync(search_web(query))
        except Exception:
            logger.exception("Web search failed for query: %s", query[:100])
            return json.dumps(
                {
                    "results": [],
                    "message": "Erro na busca web. Continuando sem resultados externos.",
                }
            )

        if not results:
            return json.dumps(
                {
                    "results": [],
                    "message": "Nenhum resultado encontrado na web.",
                }
            )

        return json.dumps({"results": results}, ensure_ascii=False)
