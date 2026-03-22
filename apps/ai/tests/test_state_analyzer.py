"""Unit tests for analyze_and_update_state() sanity checks.

Run with: cd apps/ai && uv run pytest tests/test_state_analyzer.py -v
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from src.models.interview import DomainState, InterviewState
from src.services.state_analyzer import MAX_DELTA_PER_DOMAIN, MAX_TOTAL_DELTA_PER_TURN


def _make_state(**domain_overrides: dict) -> InterviewState:
    """Build a minimal InterviewState with all 5 domains."""
    defaults = {
        "scope":        {"answered": 2, "total": 8, "vital_answered": False},
        "timeline":     {"answered": 1, "total": 5, "vital_answered": False},
        "budget":       {"answered": 1, "total": 4, "vital_answered": False},
        "integrations": {"answered": 0, "total": 6, "vital_answered": False},
        "tech_stack":   {"answered": 1, "total": 5, "vital_answered": False},
    }
    defaults.update(domain_overrides)
    return InterviewState(
        domains={k: DomainState(**v) for k, v in defaults.items()}
    )


def _analysis_response(**domain_deltas: dict) -> dict:
    """Build a minimal domains_update dict for analyze_json mock."""
    return {
        "domains_update": {
            domain: {"answered_delta": delta, "vital_answered": False}
            for domain, delta in domain_deltas.items()
        },
        "conversation_summary": "test",
        "open_questions": [],
        "last_questions_asked": [],
    }


@pytest.mark.asyncio
async def test_per_domain_delta_clamped_to_max():
    """answered_delta > MAX_DELTA_PER_DOMAIN must be clamped (delta=3, total stays <= limit)."""
    state = _make_state()
    # delta=3: exceeds MAX_DELTA_PER_DOMAIN (2) but total=3 is not > MAX_TOTAL_DELTA_PER_TURN (3)
    analysis = _analysis_response(scope=3)

    with patch("src.services.state_analyzer.analyze_json", new=AsyncMock(return_value=analysis)):
        from src.services.state_analyzer import analyze_and_update_state

        updated, _ = await analyze_and_update_state(state, "msg", "resp")

    assert updated.domains["scope"].answered == state.domains["scope"].answered + MAX_DELTA_PER_DOMAIN


@pytest.mark.asyncio
async def test_total_delta_exceeds_max_rejects_analysis():
    """Sum of deltas > MAX_TOTAL_DELTA_PER_TURN must return current state unchanged."""
    state = _make_state()
    # 2 + 2 + 2 = 6 > MAX_TOTAL_DELTA_PER_TURN (3)
    analysis = _analysis_response(scope=2, timeline=2, budget=2)

    with patch("src.services.state_analyzer.analyze_json", new=AsyncMock(return_value=analysis)):
        from src.services.state_analyzer import analyze_and_update_state

        updated, _ = await analyze_and_update_state(state, "msg", "resp")

    # All domains must be identical to the original
    for domain in state.domains:
        assert updated.domains[domain].answered == state.domains[domain].answered


@pytest.mark.asyncio
async def test_negative_delta_clamped_to_zero():
    """answered_delta=-1 must be clamped to 0 (answered never decreases)."""
    state = _make_state()
    analysis = _analysis_response(scope=-1)

    with patch("src.services.state_analyzer.analyze_json", new=AsyncMock(return_value=analysis)):
        from src.services.state_analyzer import analyze_and_update_state

        updated, _ = await analyze_and_update_state(state, "msg", "resp")

    assert updated.domains["scope"].answered == state.domains["scope"].answered


@pytest.mark.asyncio
async def test_vital_answered_never_reverts_to_false():
    """LLM returning vital_answered=False for a True domain must be ignored."""
    state = _make_state(scope={"answered": 3, "total": 8, "vital_answered": True})
    analysis = {
        "domains_update": {
            "scope": {"answered_delta": 1, "vital_answered": False},
        },
        "conversation_summary": "test",
        "open_questions": [],
        "last_questions_asked": [],
    }

    with patch("src.services.state_analyzer.analyze_json", new=AsyncMock(return_value=analysis)):
        from src.services.state_analyzer import analyze_and_update_state

        updated, _ = await analyze_and_update_state(state, "msg", "resp")

    assert updated.domains["scope"].vital_answered is True
