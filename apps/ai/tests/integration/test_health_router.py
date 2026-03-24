"""
Testes de integração para health router.
Moved from tests/test_health.py.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.mark.integration
async def test_root_endpoint() -> None:
    """GET / retorna 200 com service=oute-ai."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "oute-ai"


@pytest.mark.integration
async def test_health_services_endpoint() -> None:
    """GET /health/services retorna 200."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/services")
    assert response.status_code == 200
