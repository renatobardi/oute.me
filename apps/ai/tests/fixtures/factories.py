"""
Factories para criar objetos de teste com configurações padrão.
Permite customização enquanto mantém padrões sensatos.
"""

from typing import Any

from src.models.interview import ChatRequest, DomainState, InterviewState, MessageEntry


def make_domain_state(
    answered: int = 0,
    total: int = 5,
    vital_answered: bool = False,
) -> DomainState:
    """Factory para DomainState com valores customizáveis."""
    return DomainState(
        answered=answered,
        total=total,
        vital_answered=vital_answered,
    )


def make_interview_state(
    project_type: str = "new",
    setup_confirmed: bool = False,
    domains: dict[str, DomainState] | None = None,
    responses: dict[str, dict[str, str | bool]] | None = None,
    conversation_summary: str = "",
    open_questions: list[str] | None = None,
    documents_processed: list[str] | None = None,
    last_questions_asked: list[str] | None = None,
) -> InterviewState:
    """Factory para InterviewState com valores customizáveis."""
    return InterviewState(
        project_type=project_type,
        setup_confirmed=setup_confirmed,
        domains=domains or {},
        responses=responses or {},
        conversation_summary=conversation_summary,
        open_questions=open_questions or [],
        documents_processed=documents_processed or [],
        last_questions_asked=last_questions_asked or [],
    )


def make_interview_state_with_all_domains(
    answered_counts: dict[str, int] | None = None,
    vital_flags: dict[str, bool] | None = None,
) -> InterviewState:
    """Factory para InterviewState com todos os 5 domínios inicializados."""
    defaults_answered = {
        "scope": 0,
        "timeline": 0,
        "budget": 0,
        "integrations": 0,
        "tech_stack": 0,
    }
    defaults_vital = {
        "scope": False,
        "timeline": False,
        "budget": False,
        "integrations": False,
        "tech_stack": False,
    }

    answered_counts = {**defaults_answered, **(answered_counts or {})}
    vital_flags = {**defaults_vital, **(vital_flags or {})}

    domains = {
        "scope": DomainState(answered=answered_counts["scope"], total=5, vital_answered=vital_flags["scope"]),
        "timeline": DomainState(answered=answered_counts["timeline"], total=3, vital_answered=vital_flags["timeline"]),
        "budget": DomainState(answered=answered_counts["budget"], total=2, vital_answered=vital_flags["budget"]),
        "integrations": DomainState(
            answered=answered_counts["integrations"], total=4, vital_answered=vital_flags["integrations"]
        ),
        "tech_stack": DomainState(
            answered=answered_counts["tech_stack"], total=4, vital_answered=vital_flags["tech_stack"]
        ),
    }

    return make_interview_state(domains=domains)


def make_chat_request(
    interview_id: str = "test-interview-123",
    state: InterviewState | None = None,
    history: list[MessageEntry] | None = None,
    user_message: str = "What do you need to know?",
    documents_context: str | None = None,
    tone_instruction: str | None = None,
    is_resumption: bool = False,
    llm_model: str = "gemini-2.5-flash",
    current_title: str | None = None,
    user_name: str | None = None,
) -> ChatRequest:
    """Factory para ChatRequest com valores customizáveis."""
    if state is None:
        state = make_interview_state()
    if history is None:
        history = []

    return ChatRequest(
        interview_id=interview_id,
        state=state,
        history=history,
        user_message=user_message,
        documents_context=documents_context,
        tone_instruction=tone_instruction,
        is_resumption=is_resumption,
        llm_model=llm_model,
        current_title=current_title,
        user_name=user_name,
    )


def make_analysis_result(
    domains_update: dict[str, dict[str, Any]] | None = None,
    conversation_summary: str = "Summary of conversation so far.",
    open_questions: list[str] | None = None,
    last_questions_asked: list[str] | None = None,
) -> dict[str, object]:
    """Factory para resultado de análise de estado (mock LLM response)."""
    if domains_update is None:
        domains_update = {
            "scope": {"answered_delta": 1, "vital_answered": False},
            "timeline": {"answered_delta": 0, "vital_answered": False},
            "budget": {"answered_delta": 0, "vital_answered": False},
            "integrations": {"answered_delta": 0, "vital_answered": False},
            "tech_stack": {"answered_delta": 0, "vital_answered": False},
        }

    if open_questions is None:
        open_questions = ["What is the target audience?"]

    if last_questions_asked is None:
        last_questions_asked = ["Tell me about the project scope"]

    return {
        "domains_update": domains_update,
        "conversation_summary": conversation_summary,
        "open_questions": open_questions,
        "last_questions_asked": last_questions_asked,
    }
