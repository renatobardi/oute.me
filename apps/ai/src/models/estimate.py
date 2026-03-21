from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import BaseModel, model_validator

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared models (used in final EstimateResult)
# ---------------------------------------------------------------------------


class CostScenario(BaseModel):
    name: str
    description: str
    total_hours: float
    hourly_rate: float
    total_cost: float
    duration_weeks: int
    team_size: int
    confidence: float


class Milestone(BaseModel):
    name: str
    description: str
    duration_weeks: int
    deliverables: list[str]
    dependencies: list[str] = []


class TechRecommendation(BaseModel):
    category: str
    technology: str
    justification: str


class RiskItem(BaseModel):
    description: str
    impact: str
    mitigation: str
    probability: str


# ---------------------------------------------------------------------------
# Per-agent output models
# ---------------------------------------------------------------------------


class MarketBenchmarks(BaseModel):
    avg_cost_per_hour: float = 0
    typical_duration_weeks: float = 0
    typical_team_size: float = 0


class SimilarProject(BaseModel):
    summary: str
    relevance_score: float = 0.0
    metrics: dict[str, Any] = {}


class ValidationResult(BaseModel):
    is_consistent: bool = True
    issues_found: list[str] = []
    adjustments_made: list[str] = []


class KnowledgeMetadata(BaseModel):
    project_type: str = ""
    technologies: list[str] = []
    complexity: str = ""
    cost_range: dict[str, float] = {}
    duration_range: dict[str, float] = {}
    team_size_range: dict[str, float] = {}


class ConsolidatedRequirements(BaseModel):
    functional_requirements: list[str] = []
    non_functional_requirements: list[str] = []
    integrations: list[str] = []
    constraints: list[str] = []
    technologies: list[str] = []
    complexity_assessment: str = "medium"


class SimilarProjectsResult(BaseModel):
    similar_projects: list[SimilarProject] = []
    market_benchmarks: MarketBenchmarks = MarketBenchmarks()


class ArchitectureDesign(BaseModel):
    architecture_overview: str = ""
    milestones: list[Milestone] = []
    tech_recommendations: list[TechRecommendation] = []
    risks: list[RiskItem] = []


class CostEstimate(BaseModel):
    scenarios: list[CostScenario] = []


class ReviewResult(BaseModel):
    validation: ValidationResult = ValidationResult()
    executive_summary: str = ""


class KnowledgePrep(BaseModel):
    knowledge_text: str = ""
    metadata: KnowledgeMetadata = KnowledgeMetadata()


# ---------------------------------------------------------------------------
# Agent step tracking
# ---------------------------------------------------------------------------


class AgentStep(BaseModel):
    agent_key: str
    status: str = "pending"  # pending | running | done | failed
    started_at: str | None = None
    finished_at: str | None = None
    duration_s: float | None = None
    output_preview: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Pipeline result (holds all per-agent outputs + assembled EstimateResult)
# ---------------------------------------------------------------------------

AGENT_OUTPUT_MODELS: dict[str, type[BaseModel]] = {
    "architecture_interviewer": ConsolidatedRequirements,
    "rag_analyst": SimilarProjectsResult,
    "software_architect": ArchitectureDesign,
    "cost_specialist": CostEstimate,
    "reviewer": ReviewResult,
    "knowledge_manager": KnowledgePrep,
}


def parse_agent_output(agent_key: str, raw: str) -> BaseModel | None:
    """Parse raw agent output string into the corresponding Pydantic model.

    Returns None if parsing fails completely.
    """
    model_cls = AGENT_OUTPUT_MODELS.get(agent_key)
    if not model_cls:
        return None

    # Try to extract JSON from the raw output
    text = raw.strip()

    # Handle markdown code blocks
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start) if "```" in text[start:] else len(text)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start) if "```" in text[start:] else len(text)
        text = text[start:end].strip()

    try:
        data = json.loads(text)
        return model_cls.model_validate(data)
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning(
            "Failed to parse output for agent %s: %s (raw length=%d)",
            agent_key,
            exc,
            len(raw),
        )
        return None


# ---------------------------------------------------------------------------
# Aggregated EstimateResult
# ---------------------------------------------------------------------------


class EstimateResult(BaseModel):
    summary: str = ""
    architecture_overview: str = ""
    milestones: list[Milestone] = []
    cost_scenarios: list[CostScenario] = []
    tech_recommendations: list[TechRecommendation] = []
    risks: list[RiskItem] = []
    similar_projects: list[dict[str, object]] = []
    executive_summary: str = ""

    @model_validator(mode="before")
    @classmethod
    def _coerce_defaults(cls, data: Any) -> Any:
        """Allow partial results — missing keys get defaults."""
        if isinstance(data, dict):
            return data
        return data


def assemble_estimate_result(
    agent_outputs: dict[str, BaseModel | None],
) -> EstimateResult:
    """Merge per-agent outputs into a single EstimateResult."""
    reqs = agent_outputs.get("architecture_interviewer")
    similar = agent_outputs.get("rag_analyst")
    arch = agent_outputs.get("software_architect")
    costs = agent_outputs.get("cost_specialist")
    review = agent_outputs.get("reviewer")

    summary_parts: list[str] = []
    if isinstance(reqs, ConsolidatedRequirements):
        summary_parts.append(f"Complexidade: {reqs.complexity_assessment}")
        if reqs.functional_requirements:
            summary_parts.append(
                f"{len(reqs.functional_requirements)} requisitos funcionais identificados"
            )

    return EstimateResult(
        summary=". ".join(summary_parts) if summary_parts else "",
        architecture_overview=(
            arch.architecture_overview if isinstance(arch, ArchitectureDesign) else ""
        ),
        milestones=(arch.milestones if isinstance(arch, ArchitectureDesign) else []),
        tech_recommendations=(
            arch.tech_recommendations if isinstance(arch, ArchitectureDesign) else []
        ),
        risks=(arch.risks if isinstance(arch, ArchitectureDesign) else []),
        cost_scenarios=(costs.scenarios if isinstance(costs, CostEstimate) else []),
        similar_projects=(
            [sp.model_dump() for sp in similar.similar_projects]
            if isinstance(similar, SimilarProjectsResult)
            else []
        ),
        executive_summary=(review.executive_summary if isinstance(review, ReviewResult) else ""),
    )


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class EstimateRequest(BaseModel):
    interview_id: str
    state: dict[str, object]
    conversation_summary: str
    documents_context: str = ""
    llm_model: str = "gemini-2.5-flash"
    agent_instructions: dict[str, str] = {}
    agent_config: dict[str, dict[str, Any]] = {}


class EstimateStatusResponse(BaseModel):
    job_id: str
    status: str
    result: EstimateResult | None = None
    agent_steps: list[AgentStep] = []
