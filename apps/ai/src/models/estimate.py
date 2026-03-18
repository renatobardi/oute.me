from pydantic import BaseModel


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


class EstimateResult(BaseModel):
    summary: str
    architecture_overview: str
    milestones: list[Milestone]
    cost_scenarios: list[CostScenario]
    tech_recommendations: list[TechRecommendation]
    risks: list[RiskItem]
    similar_projects: list[dict[str, object]] = []
    executive_summary: str


class EstimateRequest(BaseModel):
    interview_id: str
    state: dict[str, object]
    conversation_summary: str
    documents_context: str = ""
    llm_model: str = "gemini-2.5-flash"


class EstimateStatusResponse(BaseModel):
    job_id: str
    status: str
    result: EstimateResult | None = None
