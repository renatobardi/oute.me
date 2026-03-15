from crewai.tools import BaseTool


class VectorSearchTool(BaseTool):
    name: str = "vector_search"
    description: str = (
        "Busca projetos e estimativas similares na base de conhecimento vetorial. "
        "Recebe uma query de texto e retorna os resultados mais relevantes."
    )

    def _run(self, query: str) -> str:
        import asyncio
        import json

        from src.services.vector_store import search_similar

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    results = executor.submit(asyncio.run, search_similar(query, limit=5)).result()
            else:
                results = asyncio.run(search_similar(query, limit=5))
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
