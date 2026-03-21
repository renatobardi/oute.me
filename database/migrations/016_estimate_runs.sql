-- 016_estimate_runs.sql
-- Histórico persistente de execuções do pipeline de estimativa
-- (separado do ai.job_state que tem TTL de 24h)

CREATE TABLE public.estimate_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id      uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  job_id           text NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  llm_model        text,
  agent_steps      jsonb DEFAULT '[]'::jsonb,
  agent_outputs    jsonb DEFAULT '{}'::jsonb,
  total_duration_s float,
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX idx_estimate_runs_estimate ON public.estimate_runs (estimate_id);
CREATE INDEX idx_estimate_runs_job     ON public.estimate_runs (job_id);

COMMENT ON TABLE public.estimate_runs IS
  'Cada linha representa uma execução do pipeline CrewAI (incluindo re-runs). '
  'Persiste agent_steps e agent_outputs mesmo após o TTL do ai.job_state expirar.';
