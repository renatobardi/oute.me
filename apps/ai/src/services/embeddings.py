from src.services.gemini import _get_client

EMBEDDING_MODEL = "text-embedding-004"


async def generate_embedding(text: str) -> list[float]:
    client = _get_client()
    result = await client.aio.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
    )
    embeddings = result.embeddings
    if embeddings is None:
        return []
    return list(embeddings[0].values or [])
