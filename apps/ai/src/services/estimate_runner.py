from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from src.crew.estimate_crew import build_estimate_crew, run_and_collect
from src.services.monitoring import emit_metric
from src.services.state import StateBackend
from src.services.vector_store import (
    delete_vectors_by_source,
    embed_interview_data,
    store_vector,
)

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)
_background_tasks: set[asyncio.Task[None]] = set()


def _run_crew_sync(
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    agent_instructions: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build and run the CrewAI pipeline, returning an aggregated result dict."""
    estimate_crew = build_estimate_crew(
        interview_state, conversation_summary, documents_context, agent_instructions or {},
    )
    return run_and_collect(estimate_crew)


async def run_pipeline(
    job_id: str,
    interview_id: str,
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    backend: StateBackend,
    llm_model: str = "gemini-2.5-flash",
    agent_instructions: dict[str, str] | None = None,
) -> None:
    """Executa o pipeline CrewAI e atualiza o estado do job.

    Pode ser chamado diretamente pelo endpoint Cloud Tasks (/estimate/execute)
    ou como background asyncio task (fallback em dev sem Cloud Tasks).
    """
    start_time = time.monotonic()
    try:
        await backend.update_job(job_id, "running")

        # Embed interview data for RAG search before pipeline runs
        try:
            await delete_vectors_by_source(
                interview_id,
                ["interview_summary", "interview_responses", "interview_document"],
            )
            await embed_interview_data(
                interview_id, interview_state, conversation_summary, documents_context,
            )
        except Exception:
            logger.exception("Failed to embed interview data for job %s (continuing)", job_id)

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _executor,
            _run_crew_sync,
            interview_state,
            conversation_summary,
            documents_context,
            agent_instructions,
        )

        # Extract internal per-agent data before storing
        agent_outputs = result.pop("_agent_outputs", {})
        agent_steps = result.pop("_agent_steps", [])

        # Store knowledge vector for future RAG searches
        try:
            knowledge_output = agent_outputs.get("knowledge_manager", {})
            knowledge_text = (
                knowledge_output.get("knowledge_text", "")
                if isinstance(knowledge_output, dict) else ""
            )
            metadata = (
                knowledge_output.get("metadata", {})
                if isinstance(knowledge_output, dict) else {}
            )
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except json.JSONDecodeError:
                    metadata = {}
            metadata["interview_id"] = interview_id
            metadata["estimate_job_id"] = job_id

            if knowledge_text:
                await store_vector(
                    source_type="estimate",
                    source_id=interview_id,
                    content=str(knowledge_text),
                    metadata=metadata,
                )
        except Exception:
            logger.exception("Failed to store knowledge vector for job %s", job_id)

        # Store result with agent tracking data
        result["_agent_steps"] = agent_steps
        result["_agent_outputs"] = agent_outputs

        await backend.update_job(job_id, "done", result)
        duration_s = time.monotonic() - start_time
        logger.info(
            "Estimate job %s completed in %.1fs (model: %s)",
            job_id, duration_s, llm_model,
        )
        await emit_metric(
            "llm/pipeline_duration", duration_s, {"status": "done", "llm_model": llm_model}
        )

    except Exception:
        duration_s = time.monotonic() - start_time
        logger.exception("Estimate job %s failed after %.1fs", job_id, duration_s)
        await backend.update_job(job_id, "failed", {"error": "Pipeline execution failed"})
        await emit_metric("llm/pipeline_duration", duration_s, {"status": "failed"})
        await emit_metric("llm/pipeline_error", 1.0, {})


async def _dispatch_cloud_tasks(
    job_id: str,
    interview_id: str,
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    llm_model: str = "gemini-2.5-flash",
    agent_instructions: dict[str, str] | None = None,
) -> None:
    from google.cloud import tasks_v2

    from src.config import settings

    client = tasks_v2.CloudTasksAsyncClient()
    queue_path = client.queue_path(
        settings.gcp_project, settings.gcp_location, settings.cloud_tasks_queue
    )

    payload = {
        "job_id": job_id,
        "interview_id": interview_id,
        "interview_state": interview_state,
        "conversation_summary": conversation_summary,
        "documents_context": documents_context,
        "llm_model": llm_model,
        "agent_instructions": agent_instructions or {},
    }

    task = tasks_v2.Task(
        http_request=tasks_v2.HttpRequest(
            http_method=tasks_v2.HttpMethod.POST,
            url=f"{settings.ai_service_url}/estimate/execute",
            headers={"Content-Type": "application/json"},
            body=json.dumps(payload).encode(),
            oidc_token=tasks_v2.OidcToken(
                service_account_email=f"oute-ai@{settings.gcp_project}.iam.gserviceaccount.com",
            ),
        )
    )

    await client.create_task(request={"parent": queue_path, "task": task})
    logger.info("Cloud Tasks task criada para job %s", job_id)


async def start_estimate(
    interview_id: str,
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    backend: StateBackend,
    llm_model: str = "gemini-2.5-flash",
    agent_instructions: dict[str, str] | None = None,
) -> str:
    from src.config import settings

    job_id = str(uuid.uuid4())

    await backend.create_job(
        job_id,
        {
            "interview_id": interview_id,
            "type": "estimate",
        },
    )

    if settings.cloud_tasks_queue and settings.ai_service_url:
        # Prod: Cloud Tasks entrega a task para /estimate/execute
        await _dispatch_cloud_tasks(
            job_id, interview_id, interview_state,
            conversation_summary, documents_context, llm_model, agent_instructions,
        )
    else:
        # Dev fallback: background asyncio task
        logger.debug("Cloud Tasks não configurado — usando background asyncio task")
        task = asyncio.create_task(
            run_pipeline(
                job_id,
                interview_id,
                interview_state,
                conversation_summary,
                documents_context,
                backend,
                llm_model,
                agent_instructions,
            )
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)

    return job_id
