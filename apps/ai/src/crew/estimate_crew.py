from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from crewai import Agent, Crew, Process, Task

from src.crew.tools import VectorSearchTool, WebSearchTool
from src.models.estimate import (
    AgentStep,
    assemble_estimate_result,
    parse_agent_output,
)

logger = logging.getLogger(__name__)

_CREW_DIR = Path(__file__).parent

# Ordered list of agent keys matching the sequential pipeline
AGENT_KEYS: list[str] = [
    "architecture_interviewer",
    "rag_analyst",
    "software_architect",
    "cost_specialist",
    "reviewer",
    "knowledge_manager",
]

StepCallback = Callable[[AgentStep], None]


def _load_yaml(filename: str) -> dict[str, object]:
    with open(_CREW_DIR / filename) as f:
        return yaml.safe_load(f)  # type: ignore[no-any-return]


def _enrich_backstory(base: str, instructions: str) -> str:
    """Append admin-editable instructions to an agent's backstory."""
    if not instructions:
        return base
    return f"{base}\n\n## Instruções de Trabalho\n{instructions}"


@dataclass
class EstimateCrew:
    """Wraps a Crew with the ordered task→agent_key mapping."""

    crew: Crew
    tasks_by_key: dict[str, Task] = field(default_factory=dict)


def build_estimate_crew(
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    agent_instructions: dict[str, str] | None = None,
    agent_config: dict[str, dict[str, Any]] | None = None,
) -> EstimateCrew:
    agents_config = _load_yaml("agents.yaml")
    tasks_config = _load_yaml("tasks.yaml")
    instructions = agent_instructions or {}
    config = agent_config or {}

    default_llm = "vertex_ai/gemini-2.5-flash-lite"

    # --- Agents ---
    def _agent(key: str, **extra: Any) -> Agent:
        cfg = agents_config[key]  # type: ignore[index]
        agent_cfg = config.get(key, {})
        temperature = agent_cfg.get("temperature", 0.7)
        max_tokens = agent_cfg.get("max_tokens", 4096)
        return Agent(
            role=cfg["role"],  # type: ignore[index]
            goal=cfg["goal"],  # type: ignore[index]
            backstory=_enrich_backstory(str(cfg["backstory"]), instructions.get(key, "")),  # type: ignore[index]
            llm=default_llm,
            llm_config={"temperature": temperature, "max_tokens": max_tokens},
            verbose=False,
            **extra,
        )

    architecture_interviewer = _agent("architecture_interviewer")
    rag_analyst = _agent("rag_analyst", tools=[VectorSearchTool(), WebSearchTool()])
    software_architect = _agent("software_architect")
    cost_specialist = _agent("cost_specialist")
    reviewer = _agent("reviewer")
    knowledge_manager = _agent("knowledge_manager")

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

    all_tasks = [
        task_consolidate,
        task_search,
        task_architecture,
        task_costs,
        task_review,
        task_knowledge,
    ]

    tasks_by_key = dict(zip(AGENT_KEYS, all_tasks, strict=True))

    crew = Crew(
        agents=[
            architecture_interviewer,
            rag_analyst,
            software_architect,
            cost_specialist,
            reviewer,
            knowledge_manager,
        ],
        tasks=all_tasks,
        process=Process.sequential,
        verbose=False,
    )

    return EstimateCrew(crew=crew, tasks_by_key=tasks_by_key)


def run_and_collect(
    estimate_crew: EstimateCrew,
    on_step: StepCallback | None = None,
) -> dict[str, Any]:
    """Run the crew and collect per-agent outputs into an aggregated result.

    After crew.kickoff(), reads each task's output via task.output.raw,
    parses and validates against per-agent Pydantic models, then assembles
    the final EstimateResult.

    Returns a dict with:
      - All EstimateResult fields (for backward compatibility)
      - "_agent_outputs": dict of raw parsed outputs per agent key
      - "_agent_steps": list of AgentStep dicts
    """
    from pydantic import BaseModel

    crew = estimate_crew.crew
    tasks_by_key = estimate_crew.tasks_by_key

    # Initialize steps list (one per agent, indexed by AGENT_KEYS order)
    steps: list[AgentStep] = [AgentStep(agent_key=key, status="pending") for key in AGENT_KEYS]

    # Run the full crew
    t0 = time.monotonic()
    logger.info("crew_pipeline_start", extra={"event": "start", "agent_count": len(AGENT_KEYS)})

    try:
        crew.kickoff()
    except Exception:
        logger.exception("CrewAI pipeline failed")
        raise

    total_duration = time.monotonic() - t0
    logger.info(
        "crew_pipeline_done",
        extra={"event": "done", "duration_s": round(total_duration, 2)},
    )

    # Collect per-agent outputs with retry on parse failure
    agent_outputs: dict[str, BaseModel | None] = {}
    agent_raw_outputs: dict[str, str] = {}

    for i, key in enumerate(AGENT_KEYS):
        task = tasks_by_key[key]
        raw = ""
        if hasattr(task, "output") and task.output is not None:
            raw = task.output.raw if hasattr(task.output, "raw") else str(task.output)

        agent_raw_outputs[key] = raw
        parsed = parse_agent_output(key, raw)

        # Retry once with a stricter JSON extraction if first attempt failed
        if parsed is None and raw:
            logger.warning(
                "agent_parse_retry",
                extra={"agent": key, "event": "retry", "raw_length": len(raw)},
            )
            # Try extracting the first JSON object/array found anywhere in the raw text
            import re
            json_match = re.search(r"\{[\s\S]+\}", raw)
            if json_match:
                try:
                    retry_data = json.loads(json_match.group(0))
                    model_cls = __import__(
                        "src.models.estimate", fromlist=["AGENT_OUTPUT_MODELS"]
                    ).AGENT_OUTPUT_MODELS.get(key)
                    if model_cls:
                        parsed = model_cls.model_validate(retry_data)
                except Exception:
                    logger.debug("Agent %s retry parse also failed", key)

        agent_outputs[key] = parsed

        # Build step record — replace the pending placeholder in-place
        step = AgentStep(
            agent_key=key,
            status="done" if parsed is not None else "failed",
            output_preview=raw[:500] if raw else None,
            error=None if parsed is not None else f"Parse failed (raw_length={len(raw)})",
        )
        steps[i] = step  # replace pending placeholder

        if on_step:
            on_step(step)

        logger.info(
            "agent_step_done",
            extra={
                "agent": key,
                "event": "step_done",
                "status": step.status,
                "output_length": len(raw),
            },
        )

    # Assemble final result
    result = assemble_estimate_result(agent_outputs)
    result_dict = result.model_dump()

    # Attach internal data for the runner (all steps, including pending if crew failed early)
    result_dict["_agent_outputs"] = {
        k: v.model_dump() if v is not None else {"_raw": agent_raw_outputs.get(k, "")}
        for k, v in agent_outputs.items()
    }
    result_dict["_agent_steps"] = [s.model_dump() for s in steps]

    return result_dict
