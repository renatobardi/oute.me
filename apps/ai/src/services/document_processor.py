import io
import logging

logger = logging.getLogger(__name__)

MAX_EXTRACTED_LENGTH = 10000


async def extract_text(file_bytes: bytes, mime_type: str, filename: str) -> str:
    try:
        if mime_type == "application/pdf":
            return _extract_pdf(file_bytes)
        elif mime_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ):
            return _extract_docx(file_bytes)
        elif mime_type in (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ):
            return _extract_xlsx(file_bytes)
        elif mime_type == "text/csv":
            return _extract_csv(file_bytes)
        elif mime_type in (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-powerpoint",
        ):
            return _extract_pptx(file_bytes)
        elif mime_type.startswith("image/"):
            return await _extract_image(file_bytes, mime_type)
        else:
            return f"[Tipo não suportado: {mime_type}]"
    except Exception:
        logger.exception("Failed to extract text from %s", filename)
        return f"[Erro ao processar {filename}]"


def _extract_pdf(file_bytes: bytes) -> str:
    import pymupdf

    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    return text[:MAX_EXTRACTED_LENGTH]


def _extract_docx(file_bytes: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return text[:MAX_EXTRACTED_LENGTH]


def _extract_xlsx(file_bytes: bytes) -> str:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    lines: list[str] = []
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        lines.append(f"[Aba: {sheet}]")
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) if c is not None else "" for c in row]
            lines.append("\t".join(cells))
    wb.close()
    text = "\n".join(lines)
    return text[:MAX_EXTRACTED_LENGTH]


def _extract_csv(file_bytes: bytes) -> str:
    import pandas as pd

    df = pd.read_csv(io.BytesIO(file_bytes))
    return df.to_string(max_rows=200)[:MAX_EXTRACTED_LENGTH]


def _extract_pptx(file_bytes: bytes) -> str:
    from pptx import Presentation

    prs = Presentation(io.BytesIO(file_bytes))
    lines: list[str] = []
    for i, slide in enumerate(prs.slides, 1):
        lines.append(f"[Slide {i}]")
        for shape in slide.shapes:
            if shape.has_text_frame:
                lines.append(shape.text_frame.text)
    text = "\n".join(lines)
    return text[:MAX_EXTRACTED_LENGTH]


async def _extract_image(file_bytes: bytes, mime_type: str) -> str:
    import base64

    from google import genai
    from google.genai.types import Content, GenerateContentConfig, Part

    from src.config import settings

    if not settings.gemini_api_key:
        return "[Gemini API key não configurada para processamento de imagem]"

    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = (
        "Extraia e descreva todo o conteúdo relevante desta imagem"
        " para estimativa de um projeto de software."
        " Inclua textos, diagramas, fluxos, e qualquer informação técnica visível."
    )
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
    contents = Content(parts=[
        Part(text=prompt),
        Part(inline_data={"mime_type": mime_type, "data": b64}),
    ])
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=contents,
        config=GenerateContentConfig(),
    )
    return (response.text or "")[:MAX_EXTRACTED_LENGTH]


async def extract_from_url(url: str) -> str:
    import httpx
    from bs4 import BeautifulSoup

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    return text[:MAX_EXTRACTED_LENGTH]
