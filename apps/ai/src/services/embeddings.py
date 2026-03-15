from src.services.gemini import _get_client

EMBEDDING_MODEL = "text-embedding-004"


async def generate_embedding(text: str) -> list[float]:
    client = _get_client()
    result = await client.aio.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
    )
    return list(result.embeddings[0].values)
