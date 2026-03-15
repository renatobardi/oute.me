import asyncio
import json
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from src.crew.estimate_crew import build_estimate_crew
from src.services.state import StateBackend
from src.services.vector_store import store_vector

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)
_background_tasks: set[asyncio.Task[None]] = set()


def _run_crew_sync(
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
) -> dict[str, Any]:
    crew = build_estimate_crew(interview_state, conversation_summary, documents_context)
    result = crew.kickoff()
    raw = result.raw if hasattr(result, "raw") else str(result)

    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        parsed = {"raw_output": raw}

    return parsed  # type: ignore[no-any-return]


async def _run_pipeline(
    job_id: str,
    interview_id: str,
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    backend: StateBackend,
) -> None:
    try:
        await backend.update_job(job_id, "running")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _executor,
            _run_crew_sync,
            interview_state,
            conversation_summary,
            documents_context,
        )

        # Store knowledge vector for future RAG searches
        try:
            knowledge = result.get("knowledge_text") or result.get("raw_output", "")
            metadata = result.get("metadata", {})
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except json.JSONDecodeError:
                    metadata = {}
            metadata["interview_id"] = interview_id  # type: ignore[index]
            metadata["estimate_job_id"] = job_id  # type: ignore[index]

            if knowledge:
                await store_vector(
                    source_type="estimate",
                    source_id=interview_id,
                    content=str(knowledge),
                    metadata=metadata,  # type: ignore[arg-type]
                )
        except Exception:
            logger.exception("Failed to store knowledge vector for job %s", job_id)

        await backend.update_job(job_id, "done", result)
        logger.info("Estimate job %s completed successfully", job_id)

    except Exception:
        logger.exception("Estimate job %s failed", job_id)
        await backend.update_job(job_id, "failed", {"error": "Pipeline execution failed"})


async def start_estimate(
    interview_id: str,
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    backend: StateBackend,
) -> str:
    job_id = str(uuid.uuid4())

    await backend.create_job(
        job_id,
        {
            "interview_id": interview_id,
            "type": "estimate",
        },
    )

    task = asyncio.create_task(
        _run_pipeline(
            job_id,
            interview_id,
            interview_state,
            conversation_summary,
            documents_context,
            backend,
        )
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return job_id
