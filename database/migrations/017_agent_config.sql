-- 017_agent_config.sql
-- Parâmetros de configuração por agente no pipeline CrewAI

ALTER TABLE public.agent_instructions
  ADD COLUMN IF NOT EXISTS temperature float     DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS max_tokens  int       DEFAULT 4096,
  ADD COLUMN IF NOT EXISTS enabled     boolean   DEFAULT true;

COMMENT ON COLUMN public.agent_instructions.temperature IS 'LLM temperature (0.0–1.0)';
COMMENT ON COLUMN public.agent_instructions.max_tokens  IS 'Max output tokens para este agente';
COMMENT ON COLUMN public.agent_instructions.enabled     IS 'Se false, o agente é ignorado no pipeline';
