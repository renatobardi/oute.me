-- 015_estimate_agent_steps.sql
-- Adiciona tracking per-agent ao histórico de estimativas

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS agent_steps jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.estimates.agent_steps IS
  'Tracking per-agente do pipeline CrewAI: [{agent_key, status, duration_s, output_preview, error}]';
