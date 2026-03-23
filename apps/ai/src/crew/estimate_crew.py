from __future__ import annotations

import json
import logging
import re
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import litellm
import yaml
from crewai import Agent, Crew, Process, Task
from litellm.integrations.custom_logger import CustomLogger

from src.crew.tools import VectorSearchTool, WebSearchTool
from src.models.estimate import (
    AGENT_OUTPUT_MODELS,
    AgentStep,
    ArchitectureDesign,
    ConsolidatedRequirements,
    CostEstimate,
    KnowledgePrep,
    ReviewResult,
    SimilarProjectsResult,
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

# Default LLM per agent — heavier models for math-heavy / validation agents.
# Can be overridden per-execution via agent_config[key]["llm_model"].
DEFAULT_AGENT_MODELS: dict[str, str] = {
    "architecture_interviewer": "vertex_ai/gemini-2.5-flash-lite",
    "rag_analyst": "vertex_ai/gemini-2.5-flash-lite",
    "software_architect": "vertex_ai/gemini-2.5-flash",
    "cost_specialist": "vertex_ai/gemini-2.5-flash",
    "reviewer": "vertex_ai/gemini-2.5-flash",
    "knowledge_manager": "vertex_ai/gemini-2.5-flash-lite",
}

# Default temperature overrides — reviewer uses 0.0 for mathematical consistency.
DEFAULT_AGENT_TEMPS: dict[str, float] = {
    "reviewer": 0.0,
}

type TaskDoneCallback = Callable[[str], None]  # called with agent_key

# ---------------------------------------------------------------------------
# Thread-local LiteLLM token tracker
# One instance per OS thread — safe for concurrent pipeline runs in the
# ThreadPoolExecutor. Each run sets/reads its own slot via threading.local().
# ---------------------------------------------------------------------------
_tls = threading.local()


class _TokenTrackerLogger(CustomLogger):
    """LiteLLM custom logger — accumulates input/output tokens per agent per thread."""

    def log_success_event(
        self,
        kwargs: Any,
        response_obj: Any,
        start_time: Any,
        end_time: Any,
        **_: Any,
    ) -> None:
        agent_key: str = getattr(_tls, "current_agent", "")
        if not agent_key:
            return
        usage = getattr(response_obj, "usage", None)
        if usage is None:
            return
        store: dict[str, dict[str, int]] = getattr(_tls, "token_store", {})
        if agent_key not in store:
            store[agent_key] = {"input": 0, "output": 0}
        store[agent_key]["input"] += getattr(usage, "prompt_tokens", 0) or 0
        store[agent_key]["output"] += getattr(usage, "completion_tokens", 0) or 0
        _tls.token_store = store

    # LiteLLM also calls async variant — provide a no-op to avoid AttributeError
    async def async_log_success_event(self, *_: Any, **__: Any) -> None:
        pass


_TOKEN_LOGGER = _TokenTrackerLogger()

# Register once at module load; the tracker is thread-local so it is safe for
# concurrent pipelines. We only add it if not already present.
_callbacks: list[CustomLogger] = litellm.callbacks  # type: ignore[assignment]
if _TOKEN_LOGGER not in _callbacks:
    _callbacks.append(_TOKEN_LOGGER)


def _init_token_tracking(first_agent_key: str) -> None:
    """Call at the start of each pipeline run (in the worker thread)."""
    _tls.current_agent = first_agent_key
    _tls.token_store = {}


def _advance_token_agent(next_agent_key: str) -> None:
    """Move the tracker to the next agent after a task callback fires."""
    _tls.current_agent = next_agent_key


def _read_agent_tokens(agent_key: str) -> tuple[int, int]:
    """Return (input_tokens, output_tokens) accumulated for agent_key."""
    store: dict[str, dict[str, int]] = getattr(_tls, "token_store", {})
    entry = store.get(agent_key, {})
    return entry.get("input", 0), entry.get("output", 0)


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
    llm_model: str = "vertex_ai/gemini-2.5-flash-lite"
    agent_durations: dict[str, float] = field(default_factory=dict)


def build_estimate_crew(
    interview_state: dict[str, object],
    conversation_summary: str,
    documents_context: str,
    agent_instructions: dict[str, str] | None = None,
    agent_config: dict[str, dict[str, Any]] | None = None,
    task_done_callback: TaskDoneCallback | None = None,
    from_agent: str | None = None,
    previous_outputs: dict[str, str] | None = None,
    llm_model: str = "vertex_ai/gemini-2.5-flash-lite",
    interview_id: str = "",
) -> EstimateCrew:
    agents_config = _load_yaml("agents.yaml")
    tasks_config = _load_yaml("tasks.yaml")
    instructions = agent_instructions or {}
    config = agent_config or {}

    default_llm = llm_model
    agent_timeout_s = 90  # per-agent hard limit

    # --- Agents ---
    def _agent(key: str, **extra: Any) -> Agent:
        cfg = agents_config[key]
        agent_cfg = config.get(key, {})
        agent_model = agent_cfg.get("llm_model") or DEFAULT_AGENT_MODELS.get(key, default_llm)
        temperature = agent_cfg.get("temperature", DEFAULT_AGENT_TEMPS.get(key, 0.7))
        max_tokens = agent_cfg.get("max_tokens", 4096)
        logger.debug("Agent %s → model=%s temperature=%s", key, agent_model, temperature)
        return Agent(
            role=cfg["role"],  # type: ignore[index]
            goal=cfg["goal"],  # type: ignore[index]
            backstory=_enrich_backstory(str(cfg["backstory"]), instructions.get(key, "")),  # type: ignore[index]
            llm=agent_model,
            llm_config={"temperature": temperature, "max_tokens": max_tokens},
            max_execution_time=agent_timeout_s,
            verbose=False,
            **extra,
        )

    architecture_interviewer = _agent("architecture_interviewer")
    rag_analyst = _agent(
        "rag_analyst",
        tools=[VectorSearchTool(interview_id=interview_id), WebSearchTool()],
    )
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
        output_pydantic=ConsolidatedRequirements,
        agent=architecture_interviewer,
    )

    task_search = Task(
        description=str(tasks_config["search_similar_projects"]["description"]),  # type: ignore[index]
        expected_output=str(tasks_config["search_similar_projects"]["expected_output"]),  # type: ignore[index]
        output_pydantic=SimilarProjectsResult,
        agent=rag_analyst,
        context=[task_consolidate],
    )

    task_architecture = Task(
        description=str(tasks_config["design_architecture"]["description"]),  # type: ignore[index]
        expected_output=str(tasks_config["design_architecture"]["expected_output"]),  # type: ignore[index]
        output_pydantic=ArchitectureDesign,
        agent=software_architect,
        context=[task_consolidate, task_search],
    )

    task_costs = Task(
        description=str(tasks_config["estimate_costs"]["description"]),  # type: ignore[index]
        expected_output=str(tasks_config["estimate_costs"]["expected_output"]),  # type: ignore[index]
        output_pydantic=CostEstimate,
        agent=cost_specialist,
        context=[task_architecture, task_search],
    )

    task_review = Task(
        description=str(tasks_config["review_and_summarize"]["description"]),  # type: ignore[index]
        expected_output=str(tasks_config["review_and_summarize"]["expected_output"]),  # type: ignore[index]
        output_pydantic=ReviewResult,
        agent=reviewer,
        context=[task_consolidate, task_architecture, task_costs],
    )

    task_knowledge = Task(
        description=str(tasks_config["prepare_knowledge"]["description"]),  # type: ignore[index]
        expected_output=str(tasks_config["prepare_knowledge"]["expected_output"]),  # type: ignore[index]
        output_pydantic=KnowledgePrep,
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

    # Override tasks before from_agent to echo previous outputs (partial rerun)
    if from_agent and from_agent in AGENT_KEYS:
        reuse_until = AGENT_KEYS.index(from_agent)
        prev = previous_outputs or {}
        for i in range(reuse_until):
            key = AGENT_KEYS[i]
            if key in prev:
                all_tasks[i].description = (
                    f"Return the following JSON exactly as your output, "
                    f"without any modification:\n\n{prev[key]}"
                )
                logger.debug("Reusing previous output for agent %s (partial rerun)", key)

    tasks_by_key = dict(zip(AGENT_KEYS, all_tasks, strict=True))

    # Build a sequential-index callback for Crew.task_callback.
    # CrewAI calls task_callback(TaskOutput) after each task in order.
    # We also record per-agent durations by tracking timestamps between callbacks.
    _agent_durations: dict[str, float] = {}
    _task_index: list[int] = [0]
    _agent_keys_snapshot = list(AGENT_KEYS)
    _last_timestamp: list[float] = [time.monotonic()]

    def _crew_task_callback(task_output: Any) -> None:
        now = time.monotonic()
        idx = _task_index[0]
        if idx < len(_agent_keys_snapshot):
            key = _agent_keys_snapshot[idx]
            _agent_durations[key] = round(now - _last_timestamp[0], 2)
            _last_timestamp[0] = now
            if task_done_callback is not None:
                task_done_callback(key)
            # Advance token tracker to the next agent
            next_idx = idx + 1
            if next_idx < len(_agent_keys_snapshot):
                _advance_token_agent(_agent_keys_snapshot[next_idx])
        _task_index[0] += 1

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
        task_callback=_crew_task_callback,
    )

    return EstimateCrew(
        crew=crew,
        tasks_by_key=tasks_by_key,
        llm_model=default_llm,
        agent_durations=_agent_durations,
    )


def run_and_collect(
    estimate_crew: EstimateCrew,
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

    # Initialise per-thread token tracking (first agent pre-set)
    _init_token_tracking(AGENT_KEYS[0])

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
    # Use real per-agent durations from task_callback; fallback to uniform division
    fallback_duration = round(total_duration / len(AGENT_KEYS), 2)

    _circuit_breaker_threshold = 2
    _consecutive_empty = 0

    for i, key in enumerate(AGENT_KEYS):
        task = tasks_by_key[key]
        raw = ""
        if hasattr(task, "output") and task.output is not None:
            raw = task.output.raw if hasattr(task.output, "raw") else str(task.output)

        # Circuit breaker: consecutive empty outputs signal Vertex AI degradation
        if not raw:
            _consecutive_empty += 1
            if _consecutive_empty >= _circuit_breaker_threshold:
                raise RuntimeError(
                    f"Circuit breaker: {_consecutive_empty} agentes consecutivos falharam. "
                    "Vertex AI pode estar indisponível."
                )
        else:
            _consecutive_empty = 0

        agent_raw_outputs[key] = raw
        parsed = parse_agent_output(key, raw)

        # Retry once with a stricter JSON extraction if first attempt failed
        if parsed is None and raw:
            logger.warning(
                "agent_parse_retry",
                extra={"agent": key, "event": "retry", "raw_length": len(raw)},
            )
            # Try extracting the first JSON object/array found anywhere in the raw text
            json_match = re.search(r"\{[\s\S]+\}", raw)
            if json_match:
                try:
                    retry_data = json.loads(json_match.group(0))
                    model_cls = AGENT_OUTPUT_MODELS.get(key)
                    if model_cls:
                        parsed = model_cls.model_validate(retry_data)
                except Exception:
                    logger.debug("Agent %s retry parse also failed", key)

        # Third tier: ask the LLM to reformat the output as valid JSON
        if parsed is None and raw:
            logger.warning(
                "agent_llm_reformat",
                extra={"agent": key, "event": "llm_retry", "raw_length": len(raw)},
            )
            try:
                model_cls = AGENT_OUTPUT_MODELS.get(key)
                if model_cls:
                    schema_str = json.dumps(model_cls.model_json_schema(), indent=2)
                    resp = litellm.completion(
                        model="vertex_ai/gemini-2.5-flash",
                        messages=[
                            {
                                "role": "user",
                                "content": (
                                    "The following text is the output of an AI agent. "
                                    "Your job is to extract it as a valid JSON object "
                                    "matching the JSON Schema below.\n"
                                    "Output ONLY the JSON object — no explanation, no markdown.\n\n"
                                    f"JSON Schema:\n{schema_str}\n\n"
                                    f"Agent output to parse:\n{raw[:3000]}"
                                ),
                            }
                        ],
                        temperature=0.0,
                        max_tokens=2048,
                    )
                    fixed_raw = resp.choices[0].message.content or ""
                    parsed = parse_agent_output(key, fixed_raw)
                    if parsed is not None:
                        logger.info(
                            "agent_llm_reformat_success",
                            extra={"agent": key, "event": "llm_retry_ok"},
                        )
            except Exception:
                logger.debug("Agent %s LLM reformat retry also failed", key, exc_info=True)

        agent_outputs[key] = parsed

        # Build step record with timing and token usage
        agent_duration = estimate_crew.agent_durations.get(key, fallback_duration)
        input_tok, output_tok = _read_agent_tokens(key)
        agent_llm = DEFAULT_AGENT_MODELS.get(key, estimate_crew.llm_model)
        step = AgentStep(
            agent_key=key,
            status="done" if parsed is not None else "failed",
            duration_s=agent_duration,
            output_preview=raw[:500] if raw else None,
            error=None if parsed is not None else f"Parse failed (raw_length={len(raw)})",
            llm_model=agent_llm,
            input_tokens=input_tok or None,
            output_tokens=output_tok or None,
        )
        steps[i] = step  # replace pending placeholder

        logger.info(
            "agent_step_done",
            extra={
                "agent": key,
                "event": "step_done",
                "status": step.status,
                "duration_s": agent_duration,
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
