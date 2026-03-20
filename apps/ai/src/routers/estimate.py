import logging

from fastapi import APIRouter, Header, HTTPException, Request

from src.models.estimate import EstimateRequest, EstimateStatusResponse
from src.services.estimate_runner import run_pipeline, start_estimate
from src.services.state import create_state_backend

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/run")
async def run_estimate(request: EstimateRequest) -> dict[str, str]:
    backend = create_state_backend()

    job_id = await start_estimate(
        interview_id=request.interview_id,
        interview_state=request.state,
        conversation_summary=request.conversation_summary,
        documents_context=request.documents_context,
        backend=backend,
        llm_model=request.llm_model,
        agent_instructions=request.agent_instructions,
    )

    return {"job_id": job_id, "status": "pending"}


@router.post("/execute")
async def execute_estimate(
    request: Request,
    x_cloudtasks_queuename: str | None = Header(default=None),
) -> dict[str, str]:
    """Endpoint exclusivo para Cloud Tasks. Executa o pipeline CrewAI de forma síncrona.

    Cloud Tasks chama este endpoint e aguarda a conclusão (timeout configurável até 30min).
    Em caso de falha (HTTP 5xx), Cloud Tasks faz retry automático com backoff exponencial.
    """
    if not x_cloudtasks_queuename:
        raise HTTPException(status_code=403, detail="Forbidden")

    payload = await request.json()
    job_id: str = payload["job_id"]
    interview_id: str = payload["interview_id"]
    interview_state: dict[str, object] = payload["interview_state"]
    conversation_summary: str = payload["conversation_summary"]
    documents_context: str = payload["documents_context"]
    llm_model: str = payload.get("llm_model", "gemini-2.5-flash")
    agent_instructions: dict[str, str] = payload.get("agent_instructions", {})

    backend = create_state_backend()

    await run_pipeline(
        job_id=job_id,
        interview_id=interview_id,
        interview_state=interview_state,
        conversation_summary=conversation_summary,
        documents_context=documents_context,
        backend=backend,
        llm_model=llm_model,
        agent_instructions=agent_instructions,
    )

    return {"job_id": job_id, "status": "done"}


@router.get("/status/{job_id}")
async def get_status(job_id: str) -> EstimateStatusResponse:
    backend = create_state_backend()
    job = await backend.get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return EstimateStatusResponse(
        job_id=job_id,
        status=str(job["status"]),
        result=job.get("result"),  # type: ignore[arg-type]
    )
