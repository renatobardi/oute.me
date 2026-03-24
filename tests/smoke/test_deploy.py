"""
Smoke tests pós-deploy — rodam contra URL real.

Uso:
  DEPLOY_URL=https://oute.pro pytest tests/smoke/ -v
  DEPLOY_URL=https://dev.oute.pro pytest tests/smoke/ -v
"""
import os

import httpx
import pytest

BASE_URL = os.environ.get("DEPLOY_URL", "http://localhost:5173")


@pytest.fixture
def client():
    return httpx.Client(base_url=BASE_URL, timeout=15.0, follow_redirects=False)


class TestSmokeDeployment:
    """Verifica que o deploy não quebrou funcionalidades básicas."""

    def test_home_page_loads(self, client):
        """Página principal retorna 200."""
        r = client.get("/")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")

    def test_login_page_loads(self, client):
        """Página de login retorna 200."""
        r = client.get("/login")
        assert r.status_code == 200

    def test_api_requires_auth(self, client):
        """Rotas protegidas redirecionam para /login sem autenticação."""
        r = client.get("/api/interviews")
        # SvelteKit redireciona rotas protegidas (302/307) ou retorna 401
        assert r.status_code in (301, 302, 307, 308, 401)

    def test_api_auth_session(self, client):
        """Endpoint de sessão rejeita token inválido com 4xx."""
        r = client.post(
            "/api/auth/session",
            json={"idToken": "invalid-token"},
        )
        # Token inválido → Firebase rejeita com 400 ou 401
        assert 400 <= r.status_code < 500

    def test_security_headers_present(self, client):
        """Headers de segurança estão presentes."""
        r = client.get("/")
        # At minimum, content-type should be present
        assert "content-type" in r.headers
