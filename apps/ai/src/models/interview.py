from pydantic import BaseModel


class DomainState(BaseModel):
    answered: int = 0
    total: int = 0
    vital_answered: bool = False


class InterviewState(BaseModel):
    project_type: str = "new"
    setup_confirmed: bool = False
    domains: dict[str, DomainState] = {}
    responses: dict[str, dict[str, str | bool]] = {}
    open_questions: list[str] = []
    documents_processed: list[str] = []
    conversation_summary: str = ""
    last_questions_asked: list[str] = []


class MessageEntry(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    interview_id: str
    state: InterviewState
    history: list[MessageEntry] = []
    user_message: str
    documents_context: str | None = None
    tone_instruction: str | None = None
    is_resumption: bool = False
    llm_model: str = "gemini-2.5-flash"


class StateUpdate(BaseModel):
    state: InterviewState
    maturity: float


DOMAIN_WEIGHTS: dict[str, float] = {
    "scope": 0.30,
    "timeline": 0.20,
    "budget": 0.20,
    "integrations": 0.15,
    "tech_stack": 0.15,
}

VITAL_REQUIRED: dict[str, bool] = {
    "scope": True,
    "timeline": True,
    "budget": True,
    "integrations": False,
    "tech_stack": True,
}


def calculate_maturity(state: InterviewState) -> float:
    score = 0.0
    for domain, weight in DOMAIN_WEIGHTS.items():
        d = state.domains.get(domain)
        if not d:
            continue
        progress = min(d.answered / d.total, 1.0) if d.total > 0 else 0.0
        score += weight * progress

    all_vital = all(
        state.domains.get(domain, DomainState()).vital_answered
        for domain, required in VITAL_REQUIRED.items()
        if required
    )

    if not all_vital:
        score *= 0.85

    return round(score, 3)
