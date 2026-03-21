"""Integration test for the CrewAI estimate pipeline.

Run with: cd apps/ai && uv run pytest tests/test_estimate_pipeline.py -v -s

NOTE: This test calls the real Vertex AI API via ADC.
Ensure GOOGLE_APPLICATION_CREDENTIALS or gcloud auth is configured.
Set VERTEXAI_PROJECT and VERTEXAI_LOCATION env vars if needed.
"""

from __future__ import annotations

import json
import logging
import os
import time

import pytest

logger = logging.getLogger(__name__)

# Ensure LiteLLM env vars are set for vertex_ai/ prefix
os.environ.setdefault("VERTEXAI_PROJECT", "oute-488706")
os.environ.setdefault("VERTEXAI_LOCATION", "us-central1")


SAMPLE_INTERVIEW_STATE: dict[str, object] = {
    "project_type": "new",
    "setup_confirmed": True,
    "domains": {
        "scope": {"answered": 6, "total": 8, "vital_answered": True},
        "timeline": {"answered": 4, "total": 5, "vital_answered": True},
        "budget": {"answered": 3, "total": 4, "vital_answered": True},
        "integrations": {"answered": 3, "total": 6, "vital_answered": False},
        "tech_stack": {"answered": 4, "total": 5, "vital_answered": True},
    },
    "responses": {
        "q_scope_001": {
            "value": "Plataforma de e-commerce B2C com marketplace de terceiros",
            "source": "user",
            "confirmed": True,
        },
        "q_scope_002": {
            "value": (
                "Catálogo de produtos com busca full-text, carrinho de compras,"
                " checkout com múltiplos meios de pagamento"
            ),
            "source": "user",
            "confirmed": True,
        },
        "q_scope_003": {
            "value": "Painel administrativo para gestão de pedidos, produtos e sellers",
            "source": "user",
            "confirmed": True,
        },
        "q_timeline_001": {
            "value": "MVP em 4 meses, versão completa em 8 meses",
            "source": "user",
            "confirmed": True,
        },
        "q_budget_001": {
            "value": "Orçamento entre R$200k e R$400k para a versão completa",
            "source": "user",
            "confirmed": True,
        },
        "q_tech_001": {
            "value": (
                "Preferência por React/Next.js no frontend e Node.js no backend. Banco PostgreSQL."
            ),
            "source": "user",
            "confirmed": True,
        },
        "q_integrations_001": {
            "value": (
                "Integração com gateway de pagamento (Stripe ou PagSeguro),"
                " sistema de frete (Correios API), e ERP via webhooks"
            ),
            "source": "user",
            "confirmed": True,
        },
    },
    "open_questions": ["q_integrations_004"],
    "documents_processed": [],
    "conversation_summary": (
        "Cliente deseja construir uma plataforma de e-commerce B2C com funcionalidade "
        "de marketplace. O escopo inclui catálogo de produtos com busca, carrinho, "
        "checkout multi-pagamento, painel admin para sellers e gestão de pedidos. "
        "Timeline: MVP em 4 meses, completo em 8 meses. Budget: R$200-400k. "
        "Stack preferida: React/Next.js + Node.js + PostgreSQL. "
        "Integrações: Stripe/PagSeguro, Correios API, ERP via webhooks."
    ),
    "last_questions_asked": ["q_integrations_004"],
}

SAMPLE_CONVERSATION_SUMMARY = SAMPLE_INTERVIEW_STATE["conversation_summary"]

SAMPLE_DOCUMENTS_CONTEXT = (
    "Documento: requisitos_marketplace.pdf\n"
    "Resumo: Documento detalha requisitos para marketplace com suporte a "
    "múltiplos sellers, split de pagamento, sistema de avaliações e "
    "gestão de comissões por categoria de produto."
)


@pytest.mark.skipif(
    not os.environ.get("RUN_INTEGRATION_TESTS"),
    reason="Set RUN_INTEGRATION_TESTS=1 to run (calls real Vertex AI)",
)
def test_full_pipeline() -> None:
    """Run the full 6-agent pipeline and validate the aggregated result."""
    from src.crew.estimate_crew import AGENT_KEYS, build_estimate_crew, run_and_collect
    from src.models.estimate import EstimateResult

    t0 = time.monotonic()

    estimate_crew = build_estimate_crew(
        interview_state=SAMPLE_INTERVIEW_STATE,  # type: ignore[arg-type]
        conversation_summary=str(SAMPLE_CONVERSATION_SUMMARY),
        documents_context=SAMPLE_DOCUMENTS_CONTEXT,
    )

    result = run_and_collect(estimate_crew)
    duration = time.monotonic() - t0

    logger.info("Pipeline completed in %.1fs", duration)

    # Should have per-agent data
    agent_outputs = result.pop("_agent_outputs", {})
    agent_steps = result.pop("_agent_steps", [])

    logger.info("Agent outputs keys: %s", list(agent_outputs.keys()))
    logger.info("Agent steps: %d", len(agent_steps))

    for key in AGENT_KEYS:
        output = agent_outputs.get(key, {})
        logger.info(
            "Agent %s: output_keys=%s",
            key,
            list(output.keys()) if isinstance(output, dict) else "raw",
        )

    # Validate against EstimateResult
    estimate_result = EstimateResult.model_validate(result)

    assert estimate_result.architecture_overview, "architecture_overview should not be empty"
    assert len(estimate_result.milestones) > 0, "Should have at least 1 milestone"
    assert len(estimate_result.cost_scenarios) > 0, "Should have at least 1 cost scenario"
    assert estimate_result.executive_summary, "executive_summary should not be empty"

    logger.info("EstimateResult validated successfully:")
    logger.info("  summary: %s", estimate_result.summary[:100])
    logger.info("  milestones: %d", len(estimate_result.milestones))
    logger.info("  cost_scenarios: %d", len(estimate_result.cost_scenarios))
    logger.info("  tech_recommendations: %d", len(estimate_result.tech_recommendations))
    logger.info("  risks: %d", len(estimate_result.risks))
    logger.info("  similar_projects: %d", len(estimate_result.similar_projects))

    assert duration < 300, f"Pipeline took too long: {duration:.1f}s (max 300s)"


def test_parse_agent_output_valid_json() -> None:
    """Test that parse_agent_output handles valid JSON correctly."""
    from src.models.estimate import ArchitectureDesign, parse_agent_output

    raw = json.dumps(
        {
            "architecture_overview": "Microservices com API Gateway",
            "milestones": [
                {
                    "name": "MVP",
                    "description": "Versão inicial",
                    "duration_weeks": 4,
                    "deliverables": ["API", "Frontend"],
                    "dependencies": [],
                }
            ],
            "tech_recommendations": [
                {
                    "category": "Backend",
                    "technology": "Node.js",
                    "justification": "Equipe tem experiência",
                }
            ],
            "risks": [
                {
                    "description": "Integração com ERP",
                    "impact": "high",
                    "mitigation": "Prototipar cedo",
                    "probability": "medium",
                }
            ],
        }
    )

    result = parse_agent_output("software_architect", raw)
    assert isinstance(result, ArchitectureDesign)
    assert result.architecture_overview == "Microservices com API Gateway"
    assert len(result.milestones) == 1
    assert result.milestones[0].name == "MVP"


def test_parse_agent_output_markdown_json() -> None:
    """Test that parse_agent_output handles JSON wrapped in markdown code blocks."""
    from src.models.estimate import ConsolidatedRequirements, parse_agent_output

    raw = '```json\n{"functional_requirements": ["Login"], "complexity_assessment": "high"}\n```'

    result = parse_agent_output("architecture_interviewer", raw)
    assert isinstance(result, ConsolidatedRequirements)
    assert result.functional_requirements == ["Login"]
    assert result.complexity_assessment == "high"


def test_parse_agent_output_invalid() -> None:
    """Test that parse_agent_output returns None for invalid output."""
    from src.models.estimate import parse_agent_output

    result = parse_agent_output("software_architect", "This is not JSON at all")
    assert result is None


def test_assemble_estimate_result() -> None:
    """Test that assemble_estimate_result merges per-agent outputs correctly."""
    from src.models.estimate import (
        ArchitectureDesign,
        ConsolidatedRequirements,
        CostEstimate,
        CostScenario,
        Milestone,
        ReviewResult,
        RiskItem,
        SimilarProjectsResult,
        TechRecommendation,
        ValidationResult,
        assemble_estimate_result,
    )

    agent_outputs = {
        "architecture_interviewer": ConsolidatedRequirements(
            functional_requirements=["Login", "Checkout"],
            complexity_assessment="high",
        ),
        "rag_analyst": SimilarProjectsResult(),
        "software_architect": ArchitectureDesign(
            architecture_overview="Monolito modular",
            milestones=[
                Milestone(
                    name="MVP",
                    description="Versão inicial",
                    duration_weeks=4,
                    deliverables=["API"],
                ),
            ],
            tech_recommendations=[
                TechRecommendation(
                    category="Backend",
                    technology="Node.js",
                    justification="Familiar",
                ),
            ],
            risks=[
                RiskItem(
                    description="ERP",
                    impact="high",
                    mitigation="Prototipar",
                    probability="medium",
                ),
            ],
        ),
        "cost_specialist": CostEstimate(
            scenarios=[
                CostScenario(
                    name="moderado",
                    description="Cenário base",
                    total_hours=800,
                    hourly_rate=120.0,
                    total_cost=96000.0,
                    duration_weeks=16,
                    team_size=4,
                    confidence=0.75,
                ),
            ],
        ),
        "reviewer": ReviewResult(
            validation=ValidationResult(is_consistent=True),
            executive_summary="Projeto viável com investimento moderado.",
        ),
        "knowledge_manager": None,
    }

    result = assemble_estimate_result(agent_outputs)

    assert result.architecture_overview == "Monolito modular"
    assert len(result.milestones) == 1
    assert result.milestones[0].name == "MVP"
    assert len(result.cost_scenarios) == 1
    assert result.cost_scenarios[0].name == "moderado"
    assert result.executive_summary == "Projeto viável com investimento moderado."
    assert "high" in result.summary.lower() or "Complexidade" in result.summary
