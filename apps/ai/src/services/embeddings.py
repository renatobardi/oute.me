import asyncio
import logging

from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-multilingual-embedding-002"

_model: TextEmbeddingModel | None = None


def _get_model() -> TextEmbeddingModel:
    global _model
    if _model is None:
        _model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
    return _model


async def generate_embedding(text: str) -> list[float]:
    model = _get_model()
    inputs = [TextEmbeddingInput(text, "RETRIEVAL_DOCUMENT")]
    loop = asyncio.get_event_loop()
    embeddings = await loop.run_in_executor(None, model.get_embeddings, inputs)
    if not embeddings:
        return []
    return list(embeddings[0].values)
