import json

from src.services.database import get_pool
from src.services.embeddings import generate_embedding


async def search_similar(query: str, limit: int = 5) -> list[dict[str, object]]:
    embedding = await generate_embedding(query)
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT id, source_type, source_id, content, metadata,
                  1 - (embedding <=> $1::vector) AS similarity
           FROM ai.knowledge_vectors
           ORDER BY embedding <=> $1::vector
           LIMIT $2""",
        str(embedding),
        limit,
    )
    return [
        {
            "id": str(row["id"]),
            "source_type": row["source_type"],
            "content": row["content"],
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
            "similarity": float(row["similarity"]),
        }
        for row in rows
    ]


async def store_vector(
    source_type: str,
    source_id: str,
    content: str,
    metadata: dict[str, object],
) -> str:
    embedding = await generate_embedding(content)
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO ai.knowledge_vectors
               (source_type, source_id, content, embedding, metadata)
           VALUES ($1, $2::uuid, $3, $4::vector, $5::jsonb)
           RETURNING id""",
        source_type,
        source_id,
        content,
        str(embedding),
        json.dumps(metadata),
    )
    assert row is not None, "INSERT RETURNING should always return a row"
    return str(row["id"])
