"""
Configura variáveis de ambiente mínimas antes que pytest importe
qualquer módulo que instancie src.config.Settings.
"""

import os
from unittest.mock import AsyncMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/oute_test")
os.environ.setdefault("GCP_PROJECT", "test-project")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("ENVIRONMENT", "test")


@pytest.fixture
def mock_analyze_json() -> AsyncMock:
    """Mock para src.services.gemini.analyze_json — evita chamadas à Vertex AI."""
    with patch("src.services.gemini.analyze_json") as mock:
        yield mock


@pytest.fixture
async def mock_database_pool() -> AsyncMock:
    """Mock para src.services.database.get_pool."""
    pool_mock = AsyncMock()
    pool_mock.acquire = AsyncMock()
    pool_mock.release = AsyncMock()
    with patch("src.services.database.get_pool", return_value=pool_mock):
        yield pool_mock


@pytest.fixture
def interview_state_empty():
    """InterviewState vazio — nenhum domínio inicializado."""
    from src.models.interview import InterviewState

    return InterviewState()


@pytest.fixture
def interview_state_partial():
    """InterviewState com alguns domínios parcialmente preenchidos."""
    from src.models.interview import DomainState, InterviewState

    return InterviewState(
        domains={
            "scope": DomainState(answered=3, total=5, vital_answered=False),
            "timeline": DomainState(answered=1, total=3, vital_answered=False),
            "budget": DomainState(answered=0, total=2, vital_answered=False),
            "integrations": DomainState(answered=2, total=4, vital_answered=False),
            "tech_stack": DomainState(answered=0, total=4, vital_answered=False),
        }
    )


@pytest.fixture
def interview_state_full():
    """InterviewState com todos os domínios vitais completos."""
    from src.models.interview import DomainState, InterviewState

    return InterviewState(
        domains={
            "scope": DomainState(answered=5, total=5, vital_answered=True),
            "timeline": DomainState(answered=3, total=3, vital_answered=True),
            "budget": DomainState(answered=2, total=2, vital_answered=True),
            "integrations": DomainState(answered=4, total=4, vital_answered=False),
            "tech_stack": DomainState(answered=4, total=4, vital_answered=True),
        }
    )


def pytest_configure(config):
    """Registra custom pytest markers."""
    config.addinivalue_line("markers", "slow: marca testes que são lentos")
    config.addinivalue_line("markers", "integration: marca testes de integração")
