from collections.abc import AsyncGenerator

from fastapi import APIRouter, UploadFile
from sse_starlette.sse import EventSourceResponse
from starlette.responses import JSONResponse

from src.models.interview import ChatRequest
from src.services.document_processor import extract_text
from src.services.interviewer import process_message

router = APIRouter()


@router.post("/message")
async def chat_message(request: ChatRequest) -> EventSourceResponse:
    async def event_generator() -> AsyncGenerator[dict[str, str], None]:
        async for event in process_message(request):
            yield event

    return EventSourceResponse(event_generator())


@router.post("/process-document")
async def process_document(file: UploadFile) -> JSONResponse:
    file_bytes = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    filename = file.filename or "unknown"

    extracted = await extract_text(file_bytes, mime_type, filename)

    return JSONResponse(
        {
            "extracted_text": extracted,
            "filename": filename,
            "status": "completed" if not extracted.startswith("[Erro") else "failed",
        }
    )
