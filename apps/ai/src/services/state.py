from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, Protocol

from src.config import settings

if TYPE_CHECKING:
    import asyncpg

JOB_TTL_HOURS = 24

# Jobs stuck in "running" longer than this are considered orphaned (worker was killed).
# Value: pipeline hard timeout (300s) + 2 heartbeat intervals (120s) + buffer (60s).
_STALE_JOB_TIMEOUT_S = 480


class StateBackend(Protocol):
    async def create_job(self, job_id: str, payload: dict[str, object]) -> None: ...
    async def get_job(self, job_id: str) -> dict[str, object] | None: ...
    async def update_job(
        self, job_id: str, status: str, result: dict[str, object] | None = None
    ) -> None: ...
    async def update_agent_steps(self, job_id: str, steps: list[dict[str, object]]) -> None: ...


def _is_stale(updated_at: Any) -> bool:
    """Return True if a 'running' job has not been touched within _STALE_JOB_TIMEOUT_S."""
    if updated_at is None:
        return False
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at)
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=UTC)
    age_s = (datetime.now(UTC) - updated_at).total_seconds()
    return age_s > _STALE_JOB_TIMEOUT_S


class RedisStateBackend:
    def __init__(self, redis_url: str) -> None:
        import redis.asyncio as aioredis

        self._redis = aioredis.from_url(redis_url, decode_responses=True)

    async def create_job(self, job_id: str, payload: dict[str, object]) -> None:
        data = json.dumps({
            "status": "pending",
            "payload": payload,
            "result": None,
            "updated_at": datetime.now(UTC).isoformat(),
        })
        await self._redis.setex(f"job:{job_id}", JOB_TTL_HOURS * 3600, data)

    async def get_job(self, job_id: str) -> dict[str, object] | None:
        data = await self._redis.get(f"job:{job_id}")
        if data is None:
            return None
        job: dict[str, Any] = json.loads(data)
        if job.get("status") == "running" and _is_stale(job.get("updated_at")):
            job["status"] = "failed"
        return job  # type: ignore[return-value]

    async def update_job(
        self, job_id: str, status: str, result: dict[str, object] | None = None
    ) -> None:
        raw = await self._redis.get(f"job:{job_id}")
        if raw is None:
            return
        job: dict[str, Any] = json.loads(raw)
        job["status"] = status
        job["updated_at"] = datetime.now(UTC).isoformat()
        if result is not None:
            job["result"] = result
        await self._redis.setex(f"job:{job_id}", JOB_TTL_HOURS * 3600, json.dumps(job))

    async def update_agent_steps(self, job_id: str, steps: list[dict[str, object]]) -> None:
        data_raw = await self._redis.get(f"job:{job_id}")
        if data_raw is None:
            return
        job: dict[str, Any] = json.loads(data_raw)
        result = job.get("result") or {}
        result["_agent_steps"] = steps
        job["result"] = result
        job["updated_at"] = datetime.now(UTC).isoformat()
        await self._redis.setex(f"job:{job_id}", JOB_TTL_HOURS * 3600, json.dumps(job))


class PostgresStateBackend:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url

    async def _get_pool(self) -> asyncpg.Pool:
        from src.services.database import get_pool

        return await get_pool()

    async def create_job(self, job_id: str, payload: dict[str, object]) -> None:
        pool = await self._get_pool()
        expires = datetime.now(UTC) + timedelta(hours=JOB_TTL_HOURS)
        await pool.execute(
            """INSERT INTO ai.job_state (job_id, status, payload, expires_at)
               VALUES ($1, 'pending', $2::jsonb, $3)""",
            job_id,
            json.dumps(payload),
            expires,
        )

    async def get_job(self, job_id: str) -> dict[str, object] | None:
        pool = await self._get_pool()
        row = await pool.fetchrow(
            "SELECT status, payload, result, updated_at FROM ai.job_state WHERE job_id = $1",
            job_id,
        )
        if row is None:
            return None
        status = row["status"]
        if status == "running" and _is_stale(row["updated_at"]):
            status = "failed"
        return {
            "status": status,
            "payload": json.loads(row["payload"]) if row["payload"] else {},
            "result": json.loads(row["result"]) if row["result"] else None,
        }

    async def update_job(
        self, job_id: str, status: str, result: dict[str, object] | None = None
    ) -> None:
        pool = await self._get_pool()
        result_json = json.dumps(result) if result else None
        await pool.execute(
            """UPDATE ai.job_state
               SET status = $1, result = $2::jsonb, updated_at = now()
               WHERE job_id = $3""",
            status,
            result_json,
            job_id,
        )

    async def update_agent_steps(self, job_id: str, steps: list[dict[str, object]]) -> None:
        pool = await self._get_pool()
        await pool.execute(
            """UPDATE ai.job_state
               SET result = COALESCE(result, '{}'::jsonb)
                         || jsonb_build_object('_agent_steps', $1::jsonb),
                   updated_at = now()
               WHERE job_id = $2""",
            json.dumps(steps),
            job_id,
        )


def create_state_backend() -> StateBackend:
    if settings.redis_url:
        return RedisStateBackend(settings.redis_url)
    return PostgresStateBackend(settings.database_url)
