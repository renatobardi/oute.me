from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Protocol

from src.config import settings

if TYPE_CHECKING:
    import asyncpg

JOB_TTL_HOURS = 24


class StateBackend(Protocol):
    async def create_job(self, job_id: str, payload: dict[str, object]) -> None: ...
    async def get_job(self, job_id: str) -> dict[str, object] | None: ...
    async def update_job(
        self, job_id: str, status: str, result: dict[str, object] | None = None
    ) -> None: ...
    async def update_agent_steps(
        self, job_id: str, steps: list[dict[str, object]]
    ) -> None: ...


class RedisStateBackend:
    def __init__(self, redis_url: str) -> None:
        import redis.asyncio as aioredis

        self._redis = aioredis.from_url(redis_url, decode_responses=True)

    async def create_job(self, job_id: str, payload: dict[str, object]) -> None:
        data = json.dumps({"status": "pending", "payload": payload, "result": None})
        await self._redis.setex(f"job:{job_id}", JOB_TTL_HOURS * 3600, data)

    async def get_job(self, job_id: str) -> dict[str, object] | None:
        data = await self._redis.get(f"job:{job_id}")
        if data is None:
            return None
        return json.loads(data)  # type: ignore[no-any-return]

    async def update_job(
        self, job_id: str, status: str, result: dict[str, object] | None = None
    ) -> None:
        job = await self.get_job(job_id)
        if job is None:
            return
        job["status"] = status
        if result is not None:
            job["result"] = result
        data = json.dumps(job)
        await self._redis.setex(f"job:{job_id}", JOB_TTL_HOURS * 3600, data)

    async def update_agent_steps(
        self, job_id: str, steps: list[dict[str, object]]
    ) -> None:
        data_raw = await self._redis.get(f"job:{job_id}")
        if data_raw is None:
            return
        job = json.loads(data_raw)
        result = job.get("result") or {}
        result["_agent_steps"] = steps
        job["result"] = result
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
            "SELECT status, payload, result FROM ai.job_state WHERE job_id = $1", job_id
        )
        if row is None:
            return None
        return {
            "status": row["status"],
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

    async def update_agent_steps(
        self, job_id: str, steps: list[dict[str, object]]
    ) -> None:
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
