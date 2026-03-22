from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def reindex_vectors() -> None:
    """REINDEX the IVFFlat index.

    Should be called periodically after significant vector insertions
    (~1000 new vectors) to keep search performance optimal.
    Uses CONCURRENTLY so reads are not blocked during the operation.
    """
    from src.services.database import get_pool

    pool = await get_pool()
    logger.info("Starting REINDEX CONCURRENTLY for knowledge_vectors_embedding_idx")
    await pool.execute(
        "REINDEX INDEX CONCURRENTLY ai.knowledge_vectors_embedding_idx"
    )
    logger.info("REINDEX completed")
