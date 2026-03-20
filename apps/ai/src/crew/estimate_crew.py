import json
import logging
from pathlib import Path

import yaml
from crewai import Agent, Crew, Process, Task

from src.crew.tools import VectorSearchTool, WebSearchTool

logger = logging.getLogger(__name__)

_CREW_DIR = Path(__file__).parent


def _load_yaml(filename: str) -> dict[str, object]:
    with open(_CREW_DIR / filename) as f:
        return yaml.safe_load(f)  # type: ignore[no-any-return]


def _enrich_backstory(base: str, instructions: str) -> str:
    """Append admin-editable instructions to an agent's backstory."""
    if not instructions:
        return base
    return f"{base}\n\n## Instruções de Trabalho\n{instructions}"


def build_estimate_crew(
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    agent_instructions: dict[str, str] | None = None,
) -> Crew:
    agents_config = _load_yaml("agents.yaml")
    tasks_config = _load_yaml("tasks.yaml")
    instructions = agent_instructions or {}

    llm = "vertex_ai/gemini-2.5-flash-lite"

    # --- Agents ---
    architecture_interviewer = Agent(
        role=agents_config["architecture_interviewer"]["role"],  # type: ignore[index]
        goal=agents_config["architecture_interviewer"]["goal"],  # type: ignore[index]
        backstory=_enrich_backstory(
            str(agents_config["architecture_interviewer"]["backstory"]),  # type: ignore[index]
            instructions.get("architecture_interviewer", ""),
        ),
        llm=llm,
        verbose=False,
    )

    rag_analyst = Agent(
        role=agents_config["rag_analyst"]["role"],  # type: ignore[index]
        goal=agents_config["rag_analyst"]["goal"],  # type: ignore[index]
        backstory=_enrich_backstory(
            str(agents_config["rag_analyst"]["backstory"]),  # type: ignore[index]
            instructions.get("rag_analyst", ""),
        ),
        llm=llm,
        tools=[VectorSearchTool(), WebSearchTool()],
        verbose=False,
    )

    software_architect = Agent(
        role=agents_config["software_architect"]["role"],  # type: ignore[index]
        goal=agents_config["software_architect"]["goal"],  # type: ignore[index]
        backstory=_enrich_backstory(
            str(agents_config["software_architect"]["backstory"]),  # type: ignore[index]
            instructions.get("software_architect", ""),
        ),
        llm=llm,
        verbose=False,
    )

    cost_specialist = Agent(
        role=agents_config["cost_specialist"]["role"],  # type: ignore[index]
        goal=agents_config["cost_specialist"]["goal"],  # type: ignore[index]
        backstory=_enrich_backstory(
            str(agents_config["cost_specialist"]["backstory"]),  # type: ignore[index]
            instructions.get("cost_specialist", ""),
        ),
        llm=llm,
        verbose=False,
    )

    reviewer = Agent(
        role=agents_config["reviewer"]["role"],  # type: ignore[index]
        goal=agents_config["reviewer"]["goal"],  # type: ignore[index]
        backstory=_enrich_backstory(
            str(agents_config["reviewer"]["backstory"]),  # type: ignore[index]
            instructions.get("reviewer", ""),
        ),
        llm=llm,
        verbose=False,
    )

    knowledge_manager = Agent(
        role=agents_config["knowledge_manager"]["role"],  # type: ignore[index]
        goal=agents_config["knowledge_manager"]["goal"],  # type: ignore[index]
        backstory=_enrich_backstory(
            str(agents_config["knowledge_manager"]["backstory"]),  # type: ignore[index]
            instructions.get("knowledge_manager", ""),
        ),
        llm=llm,
        verbose=False,
    )

    # --- Format inputs ---
    state_str = json.dumps(interview_state, ensure_ascii=False, indent=2)

    # --- Tasks (sequential) ---
    task_consolidate = Task(
        description=str(tasks_config["consolidate_requirements"]["description"]).format(  # type: ignore[index]
            interview_state=state_str,
            conversation_summary=conversation_summary,
            documents_context=documents_context or "Nenhum documento fornecido.",
        ),
        expected_output=str(tasks_config["consolidate_requirements"]["expected_output"]),  # type: ignore[index]
        agent=architecture_interviewer,
    )

    task_search = Task(
        description=str(tasks_config["search_similar_projects"]["description"]).format(  # type: ignore[index]
            consolidated_requirements="{consolidated_requirements}",
        ),
        expected_output=str(tasks_config["search_similar_projects"]["expected_output"]),  # type: ignore[index]
        agent=rag_analyst,
        context=[task_consolidate],
    )

    task_architecture = Task(
        description=str(tasks_config["design_architecture"]["description"]).format(  # type: ignore[index]
            consolidated_requirements="{consolidated_requirements}",
            similar_projects="{similar_projects}",
        ),
        expected_output=str(tasks_config["design_architecture"]["expected_output"]),  # type: ignore[index]
        agent=software_architect,
        context=[task_consolidate, task_search],
    )

    task_costs = Task(
        description=str(tasks_config["estimate_costs"]["description"]).format(  # type: ignore[index]
            architecture="{architecture}",
            similar_projects="{similar_projects}",
        ),
        expected_output=str(tasks_config["estimate_costs"]["expected_output"]),  # type: ignore[index]
        agent=cost_specialist,
        context=[task_architecture, task_search],
    )

    task_review = Task(
        description=str(tasks_config["review_and_summarize"]["description"]).format(  # type: ignore[index]
            consolidated_requirements="{consolidated_requirements}",
            architecture="{architecture}",
            cost_scenarios="{cost_scenarios}",
        ),
        expected_output=str(tasks_config["review_and_summarize"]["expected_output"]),  # type: ignore[index]
        agent=reviewer,
        context=[task_consolidate, task_architecture, task_costs],
    )

    task_knowledge = Task(
        description=str(tasks_config["prepare_knowledge"]["description"]).format(  # type: ignore[index]
            full_estimate="{full_estimate}",
        ),
        expected_output=str(tasks_config["prepare_knowledge"]["expected_output"]),  # type: ignore[index]
        agent=knowledge_manager,
        context=[task_consolidate, task_architecture, task_costs, task_review],
    )

    return Crew(
        agents=[
            architecture_interviewer,
            rag_analyst,
            software_architect,
            cost_specialist,
            reviewer,
            knowledge_manager,
        ],
        tasks=[
            task_consolidate,
            task_search,
            task_architecture,
            task_costs,
            task_review,
            task_knowledge,
        ],
        process=Process.sequential,
        verbose=False,
    )
