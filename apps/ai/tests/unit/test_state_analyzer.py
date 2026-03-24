"""
Testes para state_analyzer.py:
- _merge_passes() — pure function
- analyze_and_update_state() — com mock de analyze_json
"""

from unittest.mock import AsyncMock, patch

import pytest

from src.models.interview import calculate_maturity
from src.services.state_analyzer import (
    MAX_DELTA_PER_DOMAIN,
    _merge_passes,
    analyze_and_update_state,
)
from tests.fixtures.factories import (
    make_analysis_result,
    make_interview_state_with_all_domains,
)


class TestMergePasses:
    """Testes para _merge_passes() — função pura."""

    def test_takes_minimum_answered_delta(self) -> None:
        """Usa o menor answered_delta entre passes."""
        pass1 = {
            "domains_update": {
                "scope": {"answered_delta": 3, "vital_answered": False},
            }
        }
        pass2 = {
            "domains_update": {
                "scope": {"answered_delta": 1, "vital_answered": False},
            }
        }

        result = _merge_passes(pass1, pass2)

        merged_scope = result["domains_update"]["scope"]
        assert merged_scope["answered_delta"] == 1  # min(3, 1)

    def test_vital_answered_only_if_both_agree(self) -> None:
        """vital_answered é True só se ambos são True."""
        pass1 = {
            "domains_update": {
                "scope": {"answered_delta": 1, "vital_answered": True},
            }
        }
        pass2 = {
            "domains_update": {
                "scope": {"answered_delta": 1, "vital_answered": False},
            }
        }

        result = _merge_passes(pass1, pass2)

        assert result["domains_update"]["scope"]["vital_answered"] is False

    def test_vital_true_when_both_true(self) -> None:
        """vital_answered é True quando ambos são True."""
        pass1 = {
            "domains_update": {
                "scope": {"answered_delta": 1, "vital_answered": True},
            }
        }
        pass2 = {
            "domains_update": {
                "scope": {"answered_delta": 1, "vital_answered": True},
            }
        }

        result = _merge_passes(pass1, pass2)

        assert result["domains_update"]["scope"]["vital_answered"] is True

    def test_uses_pass1_text_fields(self) -> None:
        """conversation_summary, open_questions vêm de pass1."""
        pass1 = {
            "conversation_summary": "Pass 1 summary",
            "open_questions": ["Q1 from pass1"],
            "domains_update": {},
        }
        pass2 = {
            "conversation_summary": "Pass 2 summary (should be ignored)",
            "open_questions": ["Q1 from pass2"],
            "domains_update": {},
        }

        result = _merge_passes(pass1, pass2)

        assert result["conversation_summary"] == "Pass 1 summary"
        assert result["open_questions"] == ["Q1 from pass1"]

    def test_handles_missing_domains_in_pass(self) -> None:
        """Se um domínio falta em uma pass, delta padrão é 0 (conservador)."""
        pass1 = {
            "domains_update": {
                "scope": {"answered_delta": 2, "vital_answered": False},
            }
        }
        pass2 = {
            "domains_update": {
                "timeline": {"answered_delta": 1, "vital_answered": False},
            }
        }

        result = _merge_passes(pass1, pass2)

        # scope e timeline devem aparecer (union de domínios)
        assert "scope" in result["domains_update"]
        assert "timeline" in result["domains_update"]

        # scope só em pass1 → min(2, 0) = 0 (comportamento conservador)
        assert result["domains_update"]["scope"]["answered_delta"] == 0

        # timeline só em pass2 → min(0, 1) = 0 (comportamento conservador)
        assert result["domains_update"]["timeline"]["answered_delta"] == 0

    def test_handles_empty_domains_update(self) -> None:
        """Se domains_update está vazio/ausente, não quebra."""
        pass1 = {"conversation_summary": "Summary"}
        pass2 = {"conversation_summary": "Summary"}

        result = _merge_passes(pass1, pass2)

        assert result["domains_update"] == {}

    def test_handles_non_dict_domains_update(self) -> None:
        """Se domains_update não é dict, trata como {}."""
        pass1 = {
            "domains_update": "invalid string",
            "conversation_summary": "Summary",
        }
        pass2 = {
            "domains_update": {"scope": {"answered_delta": 1, "vital_answered": False}},
        }

        result = _merge_passes(pass1, pass2)

        # pass2 dominio contribui (pass1 é invalid)
        assert "scope" in result["domains_update"]

    def test_handles_non_dict_domain_values(self) -> None:
        """Se um domínio não é dict, trata como {} (delta=0 padrão)."""
        pass1 = {
            "domains_update": {
                "scope": "invalid string",  # não é dict → d1 = {}
            }
        }
        pass2 = {
            "domains_update": {
                "scope": {"answered_delta": 2, "vital_answered": False},
            }
        }

        result = _merge_passes(pass1, pass2)

        merged_scope = result["domains_update"]["scope"]
        # min(0_from_invalid_pass1, 2_from_pass2) = 0
        assert merged_scope["answered_delta"] == 0
        assert merged_scope["vital_answered"] is False


class TestAnalyzeAndUpdateState:
    """Testes para analyze_and_update_state() — com mock de LLM."""

    @pytest.mark.asyncio
    async def test_updates_domain_answered_count(self, mock_analyze_json: AsyncMock) -> None:
        """Incrementa answered_count no domínio baseado em answered_delta."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 2}
        )

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                "scope": {"answered_delta": 1, "vital_answered": False},
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test message",
                ai_response="Test response",
            )

        assert result_state.domains["scope"].answered == 3  # 2 + 1

    @pytest.mark.asyncio
    async def test_clamps_negative_answered_delta_to_zero(
        self, mock_analyze_json: AsyncMock
    ) -> None:
        """answered_delta negativo é puxado para 0."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 3}
        )

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                "scope": {"answered_delta": -2, "vital_answered": False},
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        # Não deve diminuir
        assert result_state.domains["scope"].answered == 3

    @pytest.mark.asyncio
    async def test_clamps_per_domain_delta_exceeding_max(
        self, mock_analyze_json: AsyncMock
    ) -> None:
        """answered_delta > MAX_DELTA_PER_DOMAIN é cappado — sem disparar rejeição total.

        Usar delta=3: excede MAX_DELTA_PER_DOMAIN(2) mas total_delta=3 ==
        MAX_TOTAL_DELTA_PER_TURN(3).
        """
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 0}
        )

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                # delta=3: > MAX_DELTA_PER_DOMAIN(2) mas total=3 não excede MAX_TOTAL(3)
                "scope": {"answered_delta": 3, "vital_answered": False},
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        assert result_state.domains["scope"].answered == MAX_DELTA_PER_DOMAIN

    @pytest.mark.asyncio
    async def test_rejects_analysis_when_total_delta_exceeds_max(
        self, mock_analyze_json: AsyncMock
    ) -> None:
        """Se total_delta > MAX_TOTAL_DELTA_PER_TURN, rejeita análise inteira."""
        original_state = make_interview_state_with_all_domains(
            answered_counts={"scope": 0, "timeline": 0}
        )

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                "scope": {"answered_delta": 2, "vital_answered": False},
                "timeline": {"answered_delta": 2, "vital_answered": False},
                "budget": {"answered_delta": 1, "vital_answered": False},
                # total = 2 + 2 + 1 = 5 > MAX (3)
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                original_state,
                user_message="Test",
                ai_response="Test",
            )

        # Estado não deve mudar
        assert result_state.domains["scope"].answered == 0
        assert result_state.domains["timeline"].answered == 0
        assert result_state.domains["budget"].answered == 0

    @pytest.mark.asyncio
    async def test_vital_answered_is_one_way(self, mock_analyze_json: AsyncMock) -> None:
        """vital_answered=True nunca reverte para False."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 5},
            vital_flags={"scope": True},
        )

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                "scope": {"answered_delta": 0, "vital_answered": False},  # LLM diz False
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        # Deve permanecer True
        assert result_state.domains["scope"].vital_answered is True

    @pytest.mark.asyncio
    async def test_updates_conversation_summary(self, mock_analyze_json: AsyncMock) -> None:
        """conversation_summary é atualizado a partir de análise."""
        state = make_interview_state_with_all_domains()

        new_summary = "Updated conversation summary"
        mock_analyze_json.return_value = make_analysis_result(
            conversation_summary=new_summary
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        assert result_state.conversation_summary == new_summary

    @pytest.mark.asyncio
    async def test_updates_open_questions(self, mock_analyze_json: AsyncMock) -> None:
        """open_questions é atualizado."""
        state = make_interview_state_with_all_domains()

        new_questions = ["Question 1", "Question 2"]
        mock_analyze_json.return_value = make_analysis_result(
            open_questions=new_questions
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        assert result_state.open_questions == new_questions

    @pytest.mark.asyncio
    async def test_returns_current_state_on_analysis_failure(
        self, mock_analyze_json: AsyncMock
    ) -> None:
        """Se LLM falhar, retorna estado atual sem mudanças."""
        original_state = make_interview_state_with_all_domains(
            answered_counts={"scope": 2}
        )

        mock_analyze_json.side_effect = Exception("LLM error")

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                original_state,
                user_message="Test",
                ai_response="Test",
            )

        assert result_state.domains["scope"].answered == 2

    @pytest.mark.asyncio
    async def test_returns_current_state_on_non_dict_response(
        self, mock_analyze_json: AsyncMock
    ) -> None:
        """Se LLM retorna não-dict, estado não muda."""
        original_state = make_interview_state_with_all_domains(
            answered_counts={"scope": 1}
        )

        mock_analyze_json.return_value = "invalid string response"

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                original_state,
                user_message="Test",
                ai_response="Test",
            )

        assert result_state.domains["scope"].answered == 1

    @pytest.mark.asyncio
    async def test_answered_never_exceeds_domain_total(
        self, mock_analyze_json: AsyncMock
    ) -> None:
        """answered é cappado em domain.total."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 4}  # total é 5
        )

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                "scope": {"answered_delta": 3, "vital_answered": False},  # 4 + 3 = 7 > 5
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        assert result_state.domains["scope"].answered == 5  # capped

    @pytest.mark.asyncio
    async def test_returns_maturity_score(self, mock_analyze_json: AsyncMock) -> None:
        """Retorna maturity score válido."""
        state = make_interview_state_with_all_domains()

        mock_analyze_json.return_value = make_analysis_result()

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            _, maturity = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        assert isinstance(maturity, float)
        assert 0.0 <= maturity <= 1.0

    @pytest.mark.asyncio
    async def test_maturity_reflects_updated_state(self, mock_analyze_json: AsyncMock) -> None:
        """Maturity reflete o estado atualizado."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 0},
            vital_flags={"scope": False, "timeline": False, "budget": False, "tech_stack": False},
        )

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                "scope": {"answered_delta": 5, "vital_answered": True},
                "timeline": {"answered_delta": 3, "vital_answered": True},
                "budget": {"answered_delta": 2, "vital_answered": True},
                "tech_stack": {"answered_delta": 4, "vital_answered": True},
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, maturity = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        # Maturity deve refletir estado atualizado
        expected_maturity = calculate_maturity(result_state)
        assert maturity == expected_maturity

    @pytest.mark.asyncio
    async def test_ignores_updates_for_missing_domains(
        self, mock_analyze_json: AsyncMock
    ) -> None:
        """Se domains_update menciona domínio não existente, ignora-o.

        Manter total_delta ≤ MAX_TOTAL_DELTA_PER_TURN(3) para evitar rejeição total.
        """
        state = make_interview_state_with_all_domains()

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                "scope": {"answered_delta": 1, "vital_answered": False},
                # nonexistent delta=1 (total=2 ≤ 3): contado no total,
                # ignorado na update
                "nonexistent": {"answered_delta": 1, "vital_answered": False},
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        # scope deve ser atualizado; nonexistent não existe em state.domains → ignorado
        assert result_state.domains["scope"].answered == 1
        assert "nonexistent" not in result_state.domains

    @pytest.mark.asyncio
    async def test_handles_string_domain_values(self, mock_analyze_json: AsyncMock) -> None:
        """Se domain value não é dict, ignora."""
        state = make_interview_state_with_all_domains(
            answered_counts={"scope": 0}
        )

        mock_analyze_json.return_value = make_analysis_result(
            domains_update={
                "scope": "invalid string instead of dict",
            }
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        # scope não deve ser atualizado
        assert result_state.domains["scope"].answered == 0

    @pytest.mark.asyncio
    async def test_updates_last_questions_asked(self, mock_analyze_json: AsyncMock) -> None:
        """last_questions_asked é atualizado."""
        state = make_interview_state_with_all_domains()

        last_questions = ["Question A", "Question B"]
        mock_analyze_json.return_value = make_analysis_result(
            last_questions_asked=last_questions
        )

        with patch("src.services.state_analyzer.analyze_json", mock_analyze_json):
            result_state, _ = await analyze_and_update_state(
                state,
                user_message="Test",
                ai_response="Test",
            )

        assert result_state.last_questions_asked == last_questions
