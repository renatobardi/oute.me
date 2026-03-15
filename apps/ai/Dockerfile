FROM python:3.12-slim AS base
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Install dependencies
COPY apps/ai/pyproject.toml apps/ai/uv.lock* ./
RUN uv sync --no-dev --no-install-project

# Copy application
COPY apps/ai/src/ ./src/

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup --home /home/appuser appuser && \
    mkdir -p /home/appuser/.local/share && \
    chown -R appuser:appgroup /app /home/appuser

USER appuser

ENV PATH="/app/.venv/bin:$PATH"
ENV ENVIRONMENT=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health/services')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
