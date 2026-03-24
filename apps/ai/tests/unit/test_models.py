"""
Testes para models de interview.py:
- DomainState
- InterviewState
- calculate_maturity()
"""

import pytest

from src.models.interview import (
    DOMAIN_WEIGHTS,
    VITAL_REQUIRED,
    DomainState,
    InterviewState,
    calculate_maturity,
)
from tests.fixtures.factories import (
    make_domain_state,
    make_interview_state,
    make_interview_state_with_all_domains,
)


class TestDomainState:
    """Testes para defaults de DomainState."""

    def test_defaults(self) -> None:
        """DomainState começa com answered=0, total=0, vital_answered=False."""
        domain = DomainState()
        assert domain.answered == 0
        assert domain.total == 0
        assert domain.vital_answered is False

    def test_customizable(self) -> None:
        """DomainState aceita valores customizados."""
        domain = DomainState(answered=3, total=5, vital_answered=True)
        assert domain.answered == 3
        assert domain.total == 5
        assert domain.vital_answered is True


class TestInterviewState:
    """Testes para defaults de InterviewState."""

    def test_defaults(self) -> None:
        """InterviewState começa com valores sensatos."""
        state = InterviewState()
        assert state.project_type == "new"
        assert state.setup_confirmed is False
        assert state.domains == {}
        assert state.responses == {}
        assert state.conversation_summary == ""
        assert state.open_questions == []
        assert state.documents_processed == []
        assert state.last_questions_asked == []

    def test_factory_creates_valid_instance(self) -> None:
        """Factory cria instância válida."""
        state = make_interview_state(
            setup_confirmed=True,
            conversation_summary="Test summary",
        )
        assert state.setup_confirmed is True
        assert state.conversation_summary == "Test summary"


class TestCalculateMaturity:
    """Testes para calculate_maturity()."""

    def test_empty_state_returns_zero(self) -> None:
        """Estado vazio (sem domínios) retorna 0.0."""
        state = make_interview_state()
        maturity = calculate_maturity(state)
        assert maturity == 0.0

    def test_single_domain_progress(self) -> None:
        """Progresso em domínio único é calculado corretamente."""
        # scope = 30% weight, 2/5 answered = 40% progress
        # maturity = 0.30 * 0.40 * 0.85 (sem vitals) = 0.102
        state = make_interview_state_with_all_domains(answered_counts={"scope": 2})
        maturity = calculate_maturity(state)

        expected = 0.30 * (2 / 5) * 0.85
        assert maturity == round(expected, 3)

    def test_multiple_domains_partial_progress(self) -> None:
        """Múltiplos domínios com progresso parcial."""
        state = make_interview_state_with_all_domains(
            answered_counts={
                "scope": 3,  # 3/5 = 60%
                "timeline": 1,  # 1/3 = 33.3%
                "budget": 0,  # 0/2 = 0%
                "integrations": 0,  # 0/4 = 0%
                "tech_stack": 0,  # 0/4 = 0%
            }
        )
        maturity = calculate_maturity(state)

        # score = 0.30*(3/5) + 0.20*(1/3) + 0.20*0 + 0.15*0 + 0.15*0
        # score = 0.18 + 0.0667 = 0.2467
        # maturity = 0.2467 * 0.85 = 0.2096
        expected = (0.30 * (3 / 5) + 0.20 * (1 / 3)) * 0.85
        assert maturity == round(expected, 3)

    def test_all_vitals_answered_no_penalty(self) -> None:
        """Quando todos os vitals são respondidos, sem penalidade 0.85."""
        state = make_interview_state_with_all_domains(
            answered_counts={
                "scope": 5,
                "timeline": 3,
                "budget": 2,
                "integrations": 0,  # não-vital
                "tech_stack": 4,
            },
            vital_flags={
                "scope": True,
                "timeline": True,
                "budget": True,
                "integrations": False,
                "tech_stack": True,
            },
        )
        maturity = calculate_maturity(state)

        # score = 0.30*1.0 + 0.20*1.0 + 0.20*1.0 + 0.15*0.0 + 0.15*1.0
        # score = 0.30 + 0.20 + 0.20 + 0.0 + 0.15 = 0.85
        # todos os vitals True, sem penalidade
        # maturity = 0.85
        assert maturity == 0.85

    def test_missing_vital_applies_penalty(self) -> None:
        """Falta vital (vital_answered=False) aplica penalidade 0.85."""
        state = make_interview_state_with_all_domains(
            answered_counts={
                "scope": 5,
                "timeline": 3,
                "budget": 2,
                "integrations": 4,
                "tech_stack": 4,
            },
            vital_flags={
                "scope": True,
                "timeline": True,
                "budget": False,  # VITAL MAS NÃO RESPONDIDO
                "integrations": False,
                "tech_stack": True,
            },
        )
        maturity = calculate_maturity(state)

        # score = 0.30*1.0 + 0.20*1.0 + 0.20*1.0 + 0.15*1.0 + 0.15*1.0 = 1.0
        # budget vital_answered=False → penalidade 0.85
        # maturity = 1.0 * 0.85 = 0.85
        assert maturity == 0.85

    def test_domain_progress_capped_at_one(self) -> None:
        """answered > total é capeado em 1.0."""
        # Simulando resposta errada onde answered > total
        domain_overstuffed = DomainState(answered=10, total=5, vital_answered=False)
        state = make_interview_state(domains={"scope": domain_overstuffed})

        maturity = calculate_maturity(state)

        # progress = min(10/5, 1.0) = 1.0
        # maturity = 0.30 * 1.0 * 0.85 = 0.255
        expected = 0.30 * 1.0 * 0.85
        assert maturity == round(expected, 3)

    def test_domain_with_zero_total(self) -> None:
        """Domínio com total=0 é ignorado (progress=0.0)."""
        domain_zero = DomainState(answered=5, total=0, vital_answered=False)
        state = make_interview_state(domains={"scope": domain_zero})

        maturity = calculate_maturity(state)

        # progress = 0.0 (due to total > 0 check)
        # maturity = 0.30 * 0.0 * 0.85 = 0.0
        assert maturity == 0.0

    def test_100_percent_completion(self) -> None:
        """Todos os domínios 100% respondidos com vitals retorna 1.0."""
        state = make_interview_state_with_all_domains(
            answered_counts={
                "scope": 5,
                "timeline": 3,
                "budget": 2,
                "integrations": 4,
                "tech_stack": 4,
            },
            vital_flags={
                "scope": True,
                "timeline": True,
                "budget": True,
                "integrations": False,
                "tech_stack": True,
            },
        )
        maturity = calculate_maturity(state)
        assert maturity == 1.0

    def test_weights_are_correct(self) -> None:
        """DOMAIN_WEIGHTS soma 1.0."""
        total = sum(DOMAIN_WEIGHTS.values())
        assert total == pytest.approx(1.0)

    def test_vital_required_constants(self) -> None:
        """VITAL_REQUIRED tem 4 vitals (scope, timeline, budget, tech_stack)."""
        vitals = [domain for domain, required in VITAL_REQUIRED.items() if required]
        assert len(vitals) == 4
        assert set(vitals) == {"scope", "timeline", "budget", "tech_stack"}

    def test_missing_domain_ignored(self) -> None:
        """Domínio ausente em state.domains é ignorado (não quebra)."""
        state = make_interview_state(
            domains={
                "scope": DomainState(answered=5, total=5, vital_answered=True),
                # Faltam timeline, budget, integrations, tech_stack
            }
        )
        maturity = calculate_maturity(state)

        # scope contribui, outros são ignorados
        # score = 0.30 * 1.0 = 0.30
        # MAS faltam vitals → penalidade
        # maturity = 0.30 * 0.85
        expected = 0.30 * 0.85
        assert maturity == round(expected, 3)

    def test_result_rounded_to_three_decimals(self) -> None:
        """Resultado é arredondado para 3 casas decimais."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 2}  # 0.30 * (2/5) * 0.85 = 0.102
        )
        maturity = calculate_maturity(state)

        # Verificar que é float com exatamente 3 decimais (ou menos)
        assert isinstance(maturity, float)
        assert maturity == round(maturity, 3)
