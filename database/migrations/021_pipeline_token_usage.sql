-- Migration 021: pipeline_token_usage
-- Stores per-agent token consumption for each estimate run.
-- Populated by the FastAPI pipeline runner via LiteLLM callbacks.

CREATE TABLE IF NOT EXISTS public.pipeline_token_usage (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_run_id  uuid REFERENCES public.estimate_runs(id) ON DELETE CASCADE,
  agent_key        text NOT NULL,
  llm_model        text NOT NULL,
  input_tokens     int  NOT NULL DEFAULT 0,
  output_tokens    int  NOT NULL DEFAULT 0,
  total_tokens     int  GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  estimated_cost_usd numeric(10,6),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_usage_run   ON public.pipeline_token_usage (estimate_run_id);
CREATE INDEX idx_token_usage_agent ON public.pipeline_token_usage (agent_key, created_at);

COMMENT ON TABLE public.pipeline_token_usage IS
  'Consumo de tokens por agente em cada run do pipeline de estimativa, populado pelo FastAPI via LiteLLM callbacks.';
