from fastapi import APIRouter, HTTPException

from src.models.estimate import EstimateRequest, EstimateStatusResponse
from src.services.estimate_runner import start_estimate
from src.services.state import create_state_backend

router = APIRouter()


@router.post("/run")
async def run_estimate(request: EstimateRequest) -> dict[str, str]:
    backend = create_state_backend()

    job_id = await start_estimate(
        interview_id=request.interview_id,
        interview_state=request.state,
        conversation_summary=request.conversation_summary,
        documents_context=request.documents_context,
        backend=backend,
    )

    return {"job_id": job_id, "status": "pending"}


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
