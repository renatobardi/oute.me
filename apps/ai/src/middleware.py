import json
import logging
import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger(__name__)

RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 100

# Stricter limit for estimate endpoints — 5 requests per hour per interview_id
ESTIMATE_RATE_LIMIT_WINDOW = 3600
ESTIMATE_RATE_LIMIT_MAX = 5


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 1)

        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "client": request.client.host if request.client else "unknown",
            },
        )

        response.headers["X-Request-Duration-Ms"] = str(duration_ms)
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._counts: dict[str, list[float]] = defaultdict(list)
        self._estimate_counts: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )

        now = time.monotonic()
        window_start = now - RATE_LIMIT_WINDOW

        # Global IP-based rate limit
        self._counts[client_ip] = [t for t in self._counts[client_ip] if t > window_start]
        self._counts[client_ip].append(now)

        if len(self._counts[client_ip]) > RATE_LIMIT_MAX:
            return Response(
                content='{"error": "Too many requests"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
            )

        # Per-interview_id rate limit for estimate write endpoints
        if request.method == "POST" and request.url.path.startswith("/estimate/"):
            try:
                body = await request.body()
                payload = json.loads(body)
                interview_id = payload.get("interview_id")
                if interview_id:
                    estimate_now = time.monotonic()
                    estimate_window_start = estimate_now - ESTIMATE_RATE_LIMIT_WINDOW
                    key = f"estimate:{interview_id}"
                    self._estimate_counts[key] = [
                        t for t in self._estimate_counts[key] if t > estimate_window_start
                    ]
                    self._estimate_counts[key].append(estimate_now)
                    if len(self._estimate_counts[key]) > ESTIMATE_RATE_LIMIT_MAX:
                        logger.warning(
                            "Rate limit hit for interview_id=%s (%d requests in 1h)",
                            interview_id,
                            len(self._estimate_counts[key]),
                        )
                        return Response(
                            content='{"error": "Too many estimate requests for this interview"}',
                            status_code=429,
                            media_type="application/json",
                            headers={"Retry-After": str(ESTIMATE_RATE_LIMIT_WINDOW)},
                        )
            except Exception:  # noqa: S110 — never block on parse errors
                pass

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
