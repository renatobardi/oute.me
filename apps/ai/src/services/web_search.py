import logging

import httpx

logger = logging.getLogger(__name__)


async def search_web(query: str, num_results: int = 5) -> list[dict[str, str]]:
    """Search using Google Custom Search JSON API.

    Returns empty list if API key not configured (graceful degradation).
    """
    from src.config import settings

    if not settings.google_search_api_key or not settings.google_search_cx:
        logger.debug("Google Search API not configured — skipping web search")
        return []

    url = "https://www.googleapis.com/customsearch/v1"
    params: dict[str, str | int] = {
        "key": settings.google_search_api_key,
        "cx": settings.google_search_cx,
        "q": query,
        "num": min(num_results, 10),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()

        data = resp.json()
        results = []
        for item in data.get("items", []):
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                }
            )
        return results
    except Exception:
        logger.exception("Web search failed for query: %s", query)
        return []
