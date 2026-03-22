from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from src.crew.estimate_crew import AGENT_KEYS
from src.models.estimate import AgentStep, EstimateRequest, EstimateStatusResponse
from src.services.estimate_runner import run_pipeline, start_estimate
from src.services.state import create_state_backend

router = APIRouter()
logger = logging.getLogger(__name__)

_INTERNAL_KEYS = {"_agent_steps", "_agent_outputs"}


def _extract_agent_steps(result: dict[str, Any] | None) -> list[AgentStep]:
    """Extract AgentStep list from the result dict (stored internally as _agent_steps)."""
    if not result:
        return []
    raw_steps = result.get("_agent_steps", [])
    steps = []
    for s in raw_steps:
        try:
            steps.append(AgentStep(**s))
        except Exception:  # noqa: S110 — intentionally silent for malformed steps
            pass
    return steps


def _clean_result(result: dict[str, Any] | None) -> dict[str, Any] | None:
    """Remove internal keys before sending result to clients."""
    if not result:
        return result
    return {k: v for k, v in result.items() if k not in _INTERNAL_KEYS}


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
        agent_config=request.agent_config,
    )

    return {"job_id": job_id, "status": "pending"}


@router.post("/execute")
async def execute_estimate(
    request: Request,
    x_cloudtasks_queuename: str | None = Header(default=None),
) -> dict[str, str]:
    """Endpoint exclusivo para Cloud Tasks. Executa o pipeline CrewAI de forma síncrona."""
    if not x_cloudtasks_queuename:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Cloud Tasks body contains only identifiers; full pipeline input is in the backend.
    payload = await request.json()
    job_id: str = payload["job_id"]
    interview_id: str = payload["interview_id"]

    backend = create_state_backend()
    job = await backend.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    pipeline_input: dict[str, Any] = (
        job.get("result") or {}  # type: ignore[union-attr]
    ).get("_pipeline_input", {})

    interview_state: dict[str, Any] = pipeline_input.get("interview_state", {})
    conversation_summary: str = pipeline_input.get("conversation_summary", "")
    documents_context: str = pipeline_input.get("documents_context", "")
    llm_model: str = pipeline_input.get("llm_model", "gemini-2.5-flash")
    agent_instructions: dict[str, str] = pipeline_input.get("agent_instructions", {})
    agent_config: dict[str, dict[str, Any]] = pipeline_input.get("agent_config", {})
    from_agent: str | None = pipeline_input.get("from_agent")
    previous_outputs: dict[str, str] | None = pipeline_input.get("previous_outputs")

    await run_pipeline(
        job_id=job_id,
        interview_id=interview_id,
        interview_state=interview_state,
        conversation_summary=conversation_summary,
        documents_context=documents_context,
        backend=backend,
        llm_model=llm_model,
        agent_instructions=agent_instructions,
        agent_config=agent_config,
        from_agent=from_agent,
        previous_outputs=previous_outputs,
    )

    return {"job_id": job_id, "status": "done"}


@router.get("/status/{job_id}")
async def get_status(job_id: str) -> EstimateStatusResponse:
    backend = create_state_backend()
    job = await backend.get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    raw_result = job.get("result")
    result_dict = raw_result if isinstance(raw_result, dict) else None
    agent_steps = _extract_agent_steps(result_dict)
    clean_result = _clean_result(result_dict)

    return EstimateStatusResponse(
        job_id=job_id,
        status=str(job["status"]),
        result=clean_result,  # type: ignore[arg-type]
        agent_steps=agent_steps,
    )


@router.get("/status/{job_id}/agent/{agent_key}")
async def get_agent_output(job_id: str, agent_key: str) -> dict[str, Any]:
    """Retorna o output completo de um agente específico (para o admin cockpit)."""
    backend = create_state_backend()
    job = await backend.get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    raw_result = job.get("result")
    result_dict2 = raw_result if isinstance(raw_result, dict) else {}
    agent_outputs = result_dict2.get("_agent_outputs", {})
    output = agent_outputs.get(agent_key) if isinstance(agent_outputs, dict) else None

    if output is None:
        raise HTTPException(status_code=404, detail=f"Output for agent '{agent_key}' not found")

    return {"agent_key": agent_key, "output": output}


@router.post("/rerun")
async def rerun_estimate(request: Request) -> dict[str, str]:
    """Re-roda o pipeline para um job existente, opcionalmente a partir de um agente específico.

    Body: {
      job_id: str,           # job original (para copiar interview_state)
      interview_id: str,
      interview_state: dict,
      conversation_summary: str,
      documents_context: str,
      llm_model: str,
      agent_instructions: dict,
      from_agent: str | null  # se fornecido, reutiliza outputs anteriores até este ponto
    }
    """
    payload = await request.json()
    from_agent: str | None = payload.get("from_agent")

    backend = create_state_backend()

    # If from_agent is set, fetch previous outputs from the old job to reuse
    previous_outputs: dict[str, str] | None = None
    if from_agent and from_agent in AGENT_KEYS and payload.get("job_id"):
        old_job = await backend.get_job(str(payload["job_id"]))
        if old_job:
            old_raw = old_job.get("result")
            old_result = old_raw if isinstance(old_raw, dict) else {}
            agent_outputs = old_result.get("_agent_outputs", {})
            if isinstance(agent_outputs, dict):
                reuse_until = AGENT_KEYS.index(from_agent)
                previous_outputs = {}
                for key in AGENT_KEYS[:reuse_until]:
                    out = agent_outputs.get(key)
                    if out is not None:
                        import json as _json

                        previous_outputs[key] = (
                            _json.dumps(out) if not isinstance(out, str) else out
                        )

    new_job_id = await start_estimate(
        interview_id=payload["interview_id"],
        interview_state=payload.get("interview_state", {}),
        conversation_summary=payload.get("conversation_summary", ""),
        documents_context=payload.get("documents_context", ""),
        backend=backend,
        llm_model=payload.get("llm_model", "gemini-2.5-flash"),
        agent_instructions=payload.get("agent_instructions", {}),
        agent_config=payload.get("agent_config", {}),
        from_agent=from_agent,
        previous_outputs=previous_outputs,
    )

    return {"job_id": new_job_id, "status": "pending"}
