"""
Testes para interview_initializer.py:
- ensure_domains_initialized()
- get_domain_progress_summary()
- get_uncovered_vital_domains()
- DEFAULT_DOMAIN_TOTALS
"""

from src.models.interview import DomainState
from src.services.interview_initializer import (
    DEFAULT_DOMAIN_TOTALS,
    ensure_domains_initialized,
    get_domain_progress_summary,
    get_uncovered_vital_domains,
)
from tests.fixtures.factories import make_interview_state, make_interview_state_with_all_domains


class TestDefaultDomainTotals:
    """Testes para a constante DEFAULT_DOMAIN_TOTALS."""

    def test_contains_all_five_domains(self) -> None:
        """DEFAULT_DOMAIN_TOTALS tem exatamente 5 domínios."""
        assert len(DEFAULT_DOMAIN_TOTALS) == 5
        assert set(DEFAULT_DOMAIN_TOTALS.keys()) == {
            "scope",
            "timeline",
            "budget",
            "integrations",
            "tech_stack",
        }

    def test_correct_values(self) -> None:
        """DEFAULT_DOMAIN_TOTALS tem valores corretos."""
        assert DEFAULT_DOMAIN_TOTALS["scope"] == 5
        assert DEFAULT_DOMAIN_TOTALS["timeline"] == 3
        assert DEFAULT_DOMAIN_TOTALS["budget"] == 2
        assert DEFAULT_DOMAIN_TOTALS["integrations"] == 4
        assert DEFAULT_DOMAIN_TOTALS["tech_stack"] == 4


class TestEnsureDomainsInitialized:
    """Testes para ensure_domains_initialized()."""

    def test_creates_all_domains_for_empty_state(self) -> None:
        """Estado vazio → criar todos os 5 domínios com totais corretos."""
        state = make_interview_state()
        result = ensure_domains_initialized(state)

        assert len(result.domains) == 5
        assert "scope" in result.domains
        assert "timeline" in result.domains
        assert "budget" in result.domains
        assert "integrations" in result.domains
        assert "tech_stack" in result.domains

    def test_initializes_with_correct_totals(self) -> None:
        """Domínios criados têm totals corretos."""
        state = make_interview_state()
        result = ensure_domains_initialized(state)

        assert result.domains["scope"].total == 5
        assert result.domains["timeline"].total == 3
        assert result.domains["budget"].total == 2
        assert result.domains["integrations"].total == 4
        assert result.domains["tech_stack"].total == 4

    def test_initializes_with_zero_answered(self) -> None:
        """Domínios criados têm answered=0."""
        state = make_interview_state()
        result = ensure_domains_initialized(state)

        for domain in result.domains.values():
            assert domain.answered == 0

    def test_initializes_with_vital_false(self) -> None:
        """Domínios criados têm vital_answered=False."""
        state = make_interview_state()
        result = ensure_domains_initialized(state)

        for domain in result.domains.values():
            assert domain.vital_answered is False

    def test_preserves_existing_domain_progress(self) -> None:
        """Domínios existentes com total>0 são preservados."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 3, "timeline": 2},
            vital_flags={"scope": True},
        )
        result = ensure_domains_initialized(state)

        # scope não deve mudar
        assert result.domains["scope"].answered == 3
        assert result.domains["scope"].vital_answered is True
        # timeline não deve mudar
        assert result.domains["timeline"].answered == 2

    def test_fixes_domain_with_zero_total(self) -> None:
        """Domínio com total=0 (legado) é corrigido."""
        state = make_interview_state(
            domains={
                "scope": DomainState(answered=2, total=0, vital_answered=False),
            }
        )
        result = ensure_domains_initialized(state)

        # scope.total deve ser corrigido para 5
        assert result.domains["scope"].total == 5
        # answered e vital_answered devem ser preservados
        assert result.domains["scope"].answered == 2
        assert result.domains["scope"].vital_answered is False

    def test_preserves_answered_and_vital_when_fixing_total(self) -> None:
        """Ao corrigir total=0, preserva answered e vital_answered."""
        state = make_interview_state(
            domains={
                "budget": DomainState(answered=1, total=0, vital_answered=True),
            }
        )
        result = ensure_domains_initialized(state)

        assert result.domains["budget"].total == 2
        assert result.domains["budget"].answered == 1
        assert result.domains["budget"].vital_answered is True

    def test_is_idempotent(self) -> None:
        """Chamar duas vezes retorna o mesmo resultado."""
        state = make_interview_state()
        result1 = ensure_domains_initialized(state)
        result2 = ensure_domains_initialized(result1)

        # Comparar domains
        for domain_name in DEFAULT_DOMAIN_TOTALS:
            d1 = result1.domains[domain_name]
            d2 = result2.domains[domain_name]
            assert d1.answered == d2.answered
            assert d1.total == d2.total
            assert d1.vital_answered == d2.vital_answered

    def test_sets_setup_confirmed_on_first_init(self) -> None:
        """Primeira inicialização (conversation_summary vazio) define setup_confirmed=True."""
        state = make_interview_state(conversation_summary="")
        result = ensure_domains_initialized(state)

        assert result.setup_confirmed is True

    def test_does_not_set_setup_confirmed_if_conversation_summary_exists(self) -> None:
        """Se conversation_summary já existe, não muda setup_confirmed."""
        state = make_interview_state(
            conversation_summary="Already have some conversation",
            setup_confirmed=False,
        )
        result = ensure_domains_initialized(state)

        assert result.setup_confirmed is False

    def test_does_not_set_setup_confirmed_if_already_true(self) -> None:
        """Se setup_confirmed já é True, mantém True mesmo com conversation vazio."""
        state = make_interview_state(
            conversation_summary="",
            setup_confirmed=True,
        )
        result = ensure_domains_initialized(state)

        assert result.setup_confirmed is True

    def test_does_not_mutate_original_state(self) -> None:
        """ensure_domains_initialized não muta o estado original."""
        state = make_interview_state()
        original_domains_count = len(state.domains)

        _ = ensure_domains_initialized(state)

        # Estado original não deve mudar
        assert len(state.domains) == original_domains_count


class TestGetDomainProgressSummary:
    """Testes para get_domain_progress_summary()."""

    def test_returns_summary_for_all_domains(self) -> None:
        """Retorna resumo para todos os 5 domínios."""
        state = make_interview_state_with_all_domains()
        summary = get_domain_progress_summary(state)

        assert len(summary) == 5
        assert "scope" in summary
        assert "timeline" in summary
        assert "budget" in summary
        assert "integrations" in summary
        assert "tech_stack" in summary

    def test_summary_structure(self) -> None:
        """Cada domínio tem answered, total, pct, vital."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 2},
        )
        summary = get_domain_progress_summary(state)

        scope_summary = summary["scope"]
        assert "answered" in scope_summary
        assert "total" in scope_summary
        assert "pct" in scope_summary
        assert "vital" in scope_summary

    def test_percentage_calculation(self) -> None:
        """Percentual calculado corretamente."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 3},  # 3/5 = 60%
        )
        summary = get_domain_progress_summary(state)

        assert summary["scope"]["answered"] == 3
        assert summary["scope"]["total"] == 5
        assert summary["scope"]["pct"] == 60.0

    def test_zero_total_returns_zero_percent(self) -> None:
        """Domínio com total=0 retorna pct=0.0."""
        state = make_interview_state(
            domains={"scope": DomainState(answered=5, total=0, vital_answered=False)}
        )
        summary = get_domain_progress_summary(state)

        assert summary["scope"]["pct"] == 0.0

    def test_missing_domain_uses_defaults(self) -> None:
        """Domínio não existente usa valores padrão."""
        state = make_interview_state()
        summary = get_domain_progress_summary(state)

        assert summary["scope"]["answered"] == 0
        assert summary["scope"]["total"] == DEFAULT_DOMAIN_TOTALS["scope"]
        assert summary["scope"]["pct"] == 0.0
        assert summary["scope"]["vital"] is False

    def test_vital_flag_included(self) -> None:
        """vital_answered é incluído no resumo."""
        state = make_interview_state_with_all_domains(
            vital_flags={"scope": True},
        )
        summary = get_domain_progress_summary(state)

        assert summary["scope"]["vital"] is True


class TestGetUncoveredVitalDomains:
    """Testes para get_uncovered_vital_domains()."""

    def test_returns_uncovered_vitals_for_fresh_state(self) -> None:
        """Estado fresco retorna todos os 4 domínios vitais."""
        state = make_interview_state_with_all_domains()
        uncovered = get_uncovered_vital_domains(state)

        assert len(uncovered) == 4
        assert set(uncovered) == {"scope", "timeline", "budget", "tech_stack"}

    def test_excludes_non_vital_integrations(self) -> None:
        """integrations (não-vital) não está na lista."""
        state = make_interview_state_with_all_domains()
        uncovered = get_uncovered_vital_domains(state)

        assert "integrations" not in uncovered

    def test_excludes_answered_vitals(self) -> None:
        """Domínios vitais com vital_answered=True são excluídos."""
        state = make_interview_state_with_all_domains(
            vital_flags={
                "scope": True,
                "timeline": True,
                "budget": False,
                "tech_stack": False,
            }
        )
        uncovered = get_uncovered_vital_domains(state)

        assert "scope" not in uncovered
        assert "timeline" not in uncovered
        assert "budget" in uncovered
        assert "tech_stack" in uncovered

    def test_returns_empty_when_all_vitals_answered(self) -> None:
        """Quando todos os vitals são respondidos, retorna lista vazia."""
        state = make_interview_state_with_all_domains(
            vital_flags={
                "scope": True,
                "timeline": True,
                "budget": True,
                "tech_stack": True,
            }
        )
        uncovered = get_uncovered_vital_domains(state)

        assert len(uncovered) == 0

    def test_handles_missing_domains(self) -> None:
        """Domínio vital faltante em state.domains é considerado uncovered."""
        state = make_interview_state()  # vazio
        uncovered = get_uncovered_vital_domains(state)

        # Todos os 4 vitals estão uncovered
        assert len(uncovered) == 4
        assert set(uncovered) == {"scope", "timeline", "budget", "tech_stack"}

    def test_partial_coverage(self) -> None:
        """Mix de cobertos e não cobertos."""
        state = make_interview_state_with_all_domains(
            vital_flags={
                "scope": True,
                "timeline": False,
                "budget": True,
                "tech_stack": False,
            }
        )
        uncovered = get_uncovered_vital_domains(state)

        assert set(uncovered) == {"timeline", "tech_stack"}
