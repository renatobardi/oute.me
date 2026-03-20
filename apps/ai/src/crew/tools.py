from crewai.tools import BaseTool


def _run_async_in_sync[T](coro: object) -> T:
    """Run an async coroutine from a sync context (CrewAI tool)."""
    import asyncio
    import concurrent.futures

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            with concurrent.futures.ThreadPoolExecutor() as executor:
                return executor.submit(asyncio.run, coro).result()  # type: ignore[arg-type]
        return asyncio.run(coro)  # type: ignore[arg-type]
    except Exception:
        return [] if not isinstance(coro, str) else ""  # type: ignore[return-value]


class VectorSearchTool(BaseTool):
    name: str = "vector_search"
    description: str = (
        "Busca projetos e estimativas similares na base de conhecimento vetorial. "
        "Recebe uma query de texto e retorna os resultados mais relevantes."
    )

    def _run(self, query: str) -> str:
        import json

        from src.services.vector_store import search_similar

        try:
            results = _run_async_in_sync(search_similar(query, limit=5))
        except Exception:
            results = []

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
            results = _run_async_in_sync(search_web(query))
        except Exception:
            results = []

        if not results:
            return json.dumps(
                {
                    "results": [],
                    "message": "Nenhum resultado encontrado na web.",
                }
            )

        return json.dumps({"results": results}, ensure_ascii=False)
