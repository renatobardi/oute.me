from __future__ import annotations

import asyncio
import contextlib
import functools
import json
import logging
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from src.crew.estimate_crew import AGENT_KEYS, build_estimate_crew, run_and_collect
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
    agent_config: dict[str, dict[str, Any]] | None = None,
    task_done_callback: Callable[[str], None] | None = None,
    from_agent: str | None = None,
    previous_outputs: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build and run the CrewAI pipeline, returning an aggregated result dict."""
    estimate_crew = build_estimate_crew(
        interview_state,
        conversation_summary,
        documents_context,
        agent_instructions or {},
        agent_config or {},
        task_done_callback=task_done_callback,
        from_agent=from_agent,
        previous_outputs=previous_outputs,
    )
    return run_and_collect(estimate_crew)


def _make_task_done_callback(
    job_id: str,
    loop: asyncio.AbstractEventLoop,
    backend: StateBackend,
) -> tuple[list[dict[str, Any]], Callable[[str], None]]:
    """Returns (steps_list, callback).

    The callback is safe to call from a ThreadPoolExecutor thread.
    It marks the given agent_key as 'done' and schedules an async
    update to the state backend via run_coroutine_threadsafe.
    """
    steps: list[dict[str, Any]] = [{"agent_key": k, "status": "pending"} for k in AGENT_KEYS]

    def on_task_done(agent_key: str) -> None:
        for step in steps:
            if step["agent_key"] == agent_key:
                step["status"] = "done"
                break
        asyncio.run_coroutine_threadsafe(
            backend.update_agent_steps(job_id, steps),
            loop,
        )

    return steps, on_task_done


_PIPELINE_TIMEOUT_S = 300  # 5 minutes hard limit for the full pipeline
_HEARTBEAT_INTERVAL_S = 60  # update updated_at every 60s so stale detection works


async def _heartbeat_loop(job_id: str, backend: StateBackend) -> None:
    """Periodically touch updated_at so stale-job detection knows the pipeline is alive."""
    while True:
        await asyncio.sleep(_HEARTBEAT_INTERVAL_S)
        with contextlib.suppress(Exception):
            await backend.update_job(job_id, "running")


async def run_pipeline(
    job_id: str,
    interview_id: str,
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    backend: StateBackend,
    llm_model: str = "gemini-2.5-flash",
    agent_instructions: dict[str, str] | None = None,
    agent_config: dict[str, dict[str, Any]] | None = None,
    from_agent: str | None = None,
    previous_outputs: dict[str, str] | None = None,
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
                interview_id,
                interview_state,
                conversation_summary,
                documents_context,
            )
        except Exception:
            logger.exception("Failed to embed interview data for job %s (continuing)", job_id)

        loop = asyncio.get_event_loop()

        # Publish all-pending steps immediately so the frontend can show the stepper
        pending_steps: list[dict[str, Any]] = [
            {"agent_key": k, "status": "pending"} for k in AGENT_KEYS
        ]
        await backend.update_agent_steps(job_id, pending_steps)

        # Build real-time callback — updates each step as it completes during execution
        _steps_ref, task_done_cb = _make_task_done_callback(job_id, loop, backend)

        fn = functools.partial(
            _run_crew_sync,
            interview_state,
            conversation_summary,
            documents_context,
            agent_instructions,
            agent_config,
            task_done_cb,
            from_agent,
            previous_outputs,
        )

        heartbeat_task = asyncio.create_task(_heartbeat_loop(job_id, backend))
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(_executor, fn),
                timeout=_PIPELINE_TIMEOUT_S,
            )
        except TimeoutError:
            logger.error(
                "pipeline_timeout",
                extra={"job_id": job_id, "event": "timeout", "timeout_s": _PIPELINE_TIMEOUT_S},
            )
            raise RuntimeError(f"Pipeline timed out after {_PIPELINE_TIMEOUT_S}s") from None
        finally:
            heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat_task

        # Extract internal per-agent data before storing
        agent_outputs: dict[str, Any] = result.pop("_agent_outputs", {})
        agent_steps: list[dict[str, Any]] = result.pop("_agent_steps", [])

        # Emit per-agent metrics and structured logs
        for step in agent_steps:
            agent_key = step.get("agent_key", "unknown")
            step_status = step.get("status", "unknown")
            duration_s = step.get("duration_s")
            agent_out = agent_outputs.get(agent_key, {})
            output_size = len(str(agent_out))

            logger.info(
                "agent_step_complete",
                extra={
                    "job_id": job_id,
                    "agent": agent_key,
                    "event": "agent_complete",
                    "status": step_status,
                    "duration_s": duration_s,
                    "output_size": output_size,
                },
            )
            if duration_s is not None:
                await emit_metric(
                    "llm/agent_duration",
                    float(duration_s),
                    {"agent": agent_key, "status": step_status},
                )
            await emit_metric(
                "llm/agent_output_size",
                float(output_size),
                {"agent": agent_key},
            )

        # Store knowledge vector for future RAG searches
        try:
            knowledge_output = agent_outputs.get("knowledge_manager", {})
            knowledge_text = (
                knowledge_output.get("knowledge_text", "")
                if isinstance(knowledge_output, dict)
                else ""
            )
            metadata = (
                knowledge_output.get("metadata", {}) if isinstance(knowledge_output, dict) else {}
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

        # Store final result with complete agent tracking data
        result["_agent_steps"] = agent_steps
        result["_agent_outputs"] = agent_outputs

        await backend.update_job(job_id, "done", result)
        duration_s = time.monotonic() - start_time
        logger.info(
            "Estimate job %s completed in %.1fs (model: %s)",
            job_id,
            duration_s,
            llm_model,
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
    agent_config: dict[str, dict[str, Any]] | None = None,
    from_agent: str | None = None,
    previous_outputs: dict[str, str] | None = None,
) -> None:
    from google.cloud import tasks_v2

    from src.config import settings

    client = tasks_v2.CloudTasksAsyncClient()
    queue_path = client.queue_path(
        settings.gcp_project, settings.gcp_location, settings.cloud_tasks_queue
    )

    payload: dict[str, Any] = {
        "job_id": job_id,
        "interview_id": interview_id,
        "interview_state": interview_state,
        "conversation_summary": conversation_summary,
        "documents_context": documents_context,
        "llm_model": llm_model,
        "agent_instructions": agent_instructions or {},
        "agent_config": agent_config or {},
    }
    if from_agent:
        payload["from_agent"] = from_agent
    if previous_outputs:
        payload["previous_outputs"] = previous_outputs

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
    agent_config: dict[str, dict[str, Any]] | None = None,
    from_agent: str | None = None,
    previous_outputs: dict[str, str] | None = None,
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
            job_id,
            interview_id,
            interview_state,
            conversation_summary,
            documents_context,
            llm_model,
            agent_instructions,
            agent_config,
            from_agent,
            previous_outputs,
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
                agent_config,
                from_agent,
                previous_outputs,
            )
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)

    return job_id
