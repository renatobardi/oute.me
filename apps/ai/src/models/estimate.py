from __future__ import annotations

import json
import logging
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared models (used in final EstimateResult)
# ---------------------------------------------------------------------------

ScenarioName = Literal["conservador", "moderado", "otimista"]


class CostScenario(BaseModel):
    name: ScenarioName
    description: str
    total_hours: float = Field(gt=0)
    hourly_rate: float = Field(gt=0)
    total_cost: float = Field(gt=0)
    duration_weeks: float = Field(gt=0)
    team_size: int = Field(ge=1)
    confidence: float = Field(ge=0.0, le=1.0)
    currency: str = "BRL"
    risk_buffer_percent: float = Field(default=0.0, ge=0.0, le=100.0)

    @field_validator("name", mode="before")
    @classmethod
    def _normalize_name(cls, v: object) -> str:
        """Normalize scenario name: strip whitespace, lowercase."""
        if isinstance(v, str):
            return v.strip().lower()
        return str(v).strip().lower()

    @model_validator(mode="after")
    def _fix_total_cost(self) -> CostScenario:
        """Auto-correct total_cost if it deviates >5% from hours x rate."""
        expected = self.total_hours * self.hourly_rate
        if expected > 0:
            deviation = abs(self.total_cost - expected) / expected
            if deviation > 0.05:
                logger.warning(
                    "CostScenario '%s': total_cost %.2f deviates %.1f%% from "
                    "total_hours(%.1f) x hourly_rate(%.2f) = %.2f -- auto-correcting",
                    self.name,
                    self.total_cost,
                    deviation * 100,
                    self.total_hours,
                    self.hourly_rate,
                    expected,
                )
                self.total_cost = round(expected, 2)
        return self


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


# --- Reviewer models ---

IssueSeverity = Literal["critical", "warning", "info"]
IssueCategory = Literal[
    "cost_consistency",
    "timeline_consistency",
    "requirement_coverage",
    "risk_coverage",
    "mathematical",
    "general",
]


class ValidationIssue(BaseModel):
    category: IssueCategory
    severity: IssueSeverity
    description: str
    affected_agent: str = ""
    resolved: bool = False

    @field_validator("category", mode="before")
    @classmethod
    def _normalize_category(cls, v: object) -> str:
        if isinstance(v, str):
            return v.strip().lower().replace(" ", "_")
        return str(v).strip().lower()

    @field_validator("severity", mode="before")
    @classmethod
    def _normalize_severity(cls, v: object) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return str(v).strip().lower()


class ValidationAdjustment(BaseModel):
    description: str
    field_adjusted: str = ""
    original_value: str = ""
    adjusted_value: str = ""
    reason: str = ""


class ValidationResult(BaseModel):
    is_consistent: bool = True
    issues_found: list[ValidationIssue] = []
    adjustments_made: list[ValidationAdjustment] = []
    requirements_coverage_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    risk_coverage_pct: float = Field(default=0.0, ge=0.0, le=100.0)

    @model_validator(mode="after")
    def _auto_consistency(self) -> ValidationResult:
        """Set is_consistent=False if any critical issue is unresolved."""
        critical_unresolved = [
            i for i in self.issues_found if i.severity == "critical" and not i.resolved
        ]
        if critical_unresolved:
            self.is_consistent = False
        return self


# --- Knowledge Manager models ---

ComplexityLevel = Literal["low", "medium", "high", "very_high"]


class NumericRange(BaseModel):
    min: float = Field(default=0, ge=0)
    max: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _ensure_min_le_max(self) -> NumericRange:
        """Auto-correct if min > max."""
        if self.min > self.max:
            self.min, self.max = self.max, self.min
        return self


class KnowledgeMetadata(BaseModel):
    project_type: str = ""
    technologies: list[str] = []
    complexity: ComplexityLevel = "medium"
    cost_range: NumericRange = NumericRange()
    duration_range: NumericRange = NumericRange()
    team_size_range: NumericRange = NumericRange()
    integrations_count: int = Field(default=0, ge=0)
    requirements_count: int = Field(default=0, ge=0)

    @field_validator("complexity", mode="before")
    @classmethod
    def _normalize_complexity(cls, v: object) -> str:
        if isinstance(v, str):
            normalized = v.strip().lower().replace(" ", "_")
            valid = {"low", "medium", "high", "very_high"}
            return normalized if normalized in valid else "medium"
        return "medium"

    @model_validator(mode="before")
    @classmethod
    def _coerce_ranges(cls, data: Any) -> Any:
        """Accept legacy dict formats like {"min_weeks": X, "max_weeks": Y}."""
        if isinstance(data, dict):
            for range_field in ("cost_range", "duration_range", "team_size_range"):
                val = data.get(range_field)
                if isinstance(val, dict) and "min" not in val:
                    keys = list(val.keys())
                    if len(keys) >= 2:
                        values = list(val.values())
                        data[range_field] = {"min": values[0], "max": values[1]}
        return data


# --- Common per-agent output models ---


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


_SCENARIO_ORDER: dict[str, int] = {"conservador": 0, "moderado": 1, "otimista": 2}


class CostEstimate(BaseModel):
    scenarios: list[CostScenario] = []

    @model_validator(mode="after")
    def _validate_scenarios(self) -> CostEstimate:
        """Ensure exactly 3 scenarios in the correct order (cost descending)."""
        if len(self.scenarios) != 3:
            logger.warning(
                "CostEstimate: expected 3 scenarios, got %d",
                len(self.scenarios),
            )

        # Sort by expected order: conservador, moderado, otimista
        names = [s.name for s in self.scenarios]
        expected_order = sorted(names, key=lambda n: _SCENARIO_ORDER.get(n, 99))
        if names != expected_order:
            logger.warning(
                "CostEstimate: scenarios out of order %s — reordering",
                names,
            )
            self.scenarios.sort(key=lambda s: _SCENARIO_ORDER.get(s.name, 99))

        # Validate cost ordering: conservador >= moderado >= otimista
        if len(self.scenarios) == 3:
            costs = [s.total_cost for s in self.scenarios]
            if not (costs[0] >= costs[1] >= costs[2]):
                logger.warning(
                    "CostEstimate: cost ordering inconsistent "
                    "(conservador=%.2f, moderado=%.2f, otimista=%.2f)",
                    *costs,
                )

        return self


class ReviewResult(BaseModel):
    validation: ValidationResult = ValidationResult()
    executive_summary: str = ""

    @field_validator("executive_summary", mode="before")
    @classmethod
    def _strip_summary(cls, v: object) -> str:
        if isinstance(v, str):
            return v.strip()
        return str(v).strip()


class KnowledgePrep(BaseModel):
    knowledge_text: str = Field(default="", max_length=8000)
    metadata: KnowledgeMetadata = KnowledgeMetadata()

    @field_validator("knowledge_text", mode="before")
    @classmethod
    def _strip_text(cls, v: object) -> str:
        if isinstance(v, str):
            return v.strip()
        return str(v).strip()


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
    llm_model: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None


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
    validation: ValidationResult | None = None

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
        validation=(review.validation if isinstance(review, ReviewResult) else None),
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
