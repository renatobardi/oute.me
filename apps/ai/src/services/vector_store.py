import json
import logging

from src.services.database import get_pool
from src.services.embeddings import generate_embedding

logger = logging.getLogger(__name__)

# Embedding model text-multilingual-embedding-002 has a 2048 token input limit.
# Using ~4 chars/token heuristic for chunking.
_CHARS_PER_TOKEN = 4
_MAX_CHUNK_TOKENS = 1000
_OVERLAP_TOKENS = 200
_MAX_CHUNK_CHARS = _MAX_CHUNK_TOKENS * _CHARS_PER_TOKEN
_OVERLAP_CHARS = _OVERLAP_TOKENS * _CHARS_PER_TOKEN


def chunk_text(
    text: str, max_chars: int = _MAX_CHUNK_CHARS, overlap: int = _OVERLAP_CHARS
) -> list[str]:
    """Split text into overlapping chunks for embedding."""
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunk = text[start:end]
        chunks.append(chunk)
        start += max_chars - overlap
    return chunks


async def store_chunks(
    source_type: str,
    source_id: str,
    content: str,
    metadata: dict[str, object],
) -> list[str]:
    """Store content as chunked vectors. Returns list of vector IDs."""
    chunks = chunk_text(content)
    vector_ids: list[str] = []
    for i, chunk in enumerate(chunks):
        chunk_metadata = {**metadata, "chunk_index": i, "total_chunks": len(chunks)}
        vid = await store_vector(source_type, source_id, chunk, chunk_metadata)
        vector_ids.append(vid)
    return vector_ids


async def delete_vectors_by_source(
    source_id: str,
    source_types: list[str],
) -> int:
    """Delete vectors matching source_id and any of the given source_types."""
    pool = await get_pool()
    result = await pool.execute(
        """DELETE FROM ai.knowledge_vectors
           WHERE source_id = $1::uuid AND source_type = ANY($2::text[])""",
        source_id,
        source_types,
    )
    count = int(result.split()[-1]) if result else 0
    logger.info("Deleted %d vectors for source_id=%s types=%s", count, source_id, source_types)
    return count


async def embed_interview_data(
    interview_id: str,
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
) -> list[str]:
    """Embed interview data as vectors so RAG Analyst can find them."""
    vector_ids: list[str] = []

    if conversation_summary:
        ids = await store_chunks(
            source_type="interview_summary",
            source_id=interview_id,
            content=conversation_summary,
            metadata={"interview_id": interview_id, "data_type": "summary"},
        )
        vector_ids.extend(ids)

    responses = interview_state.get("responses", {})
    if responses and isinstance(responses, dict):
        responses_text = "\n".join(
            f"{k}: {v.get('value', '')}" for k, v in responses.items() if isinstance(v, dict)
        )
        if responses_text:
            ids = await store_chunks(
                source_type="interview_responses",
                source_id=interview_id,
                content=responses_text,
                metadata={"interview_id": interview_id, "data_type": "responses"},
            )
            vector_ids.extend(ids)

    if documents_context:
        ids = await store_chunks(
            source_type="interview_document",
            source_id=interview_id,
            content=documents_context,
            metadata={"interview_id": interview_id, "data_type": "document"},
        )
        vector_ids.extend(ids)

    logger.info("Embedded %d vectors for interview %s", len(vector_ids), interview_id)
    return vector_ids


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
