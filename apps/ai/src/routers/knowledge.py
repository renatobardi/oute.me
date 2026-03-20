from fastapi import APIRouter
from pydantic import BaseModel
from starlette.responses import JSONResponse

from src.services.vector_store import store_chunks

router = APIRouter()


class EmbedRequest(BaseModel):
    id: str
    content: str
    metadata: dict[str, object] = {}


@router.post("/embed")
async def embed_knowledge(request: EmbedRequest) -> JSONResponse:
    """Embed admin knowledge content into vector store (with chunking for large texts)."""
    vector_ids = await store_chunks(
        source_type="admin_knowledge",
        source_id=request.id,
        content=request.content,
        metadata=request.metadata,
    )
    return JSONResponse({"vector_ids": vector_ids, "count": len(vector_ids), "status": "embedded"})
