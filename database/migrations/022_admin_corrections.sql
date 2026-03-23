-- Migration 022: admin corrections
-- Resolve dois findings da auditoria ADR-12:
--
-- M-05: ON CONFLICT DO NOTHING em interview_state_snapshots exigia unique constraint
--   inexistente — criado aqui para garantir idempotência do upsert.
--
-- M-06/M-07: pipeline_token_usage (migration 021) nunca recebeu INSERTs.
--   O pipeline escreve tokens no JSONB agent_steps de estimate_runs, e a query
--   de token stats lê desse JSONB. A tabela está vazia e seu índice estava em
--   ordem subótima (agent_key, created_at) para os filtros reais.
--   Decisão: manter JSONB como fonte de verdade e dropar a tabela órfã.

-- M-05: unique constraint para ON CONFLICT DO NOTHING funcionar corretamente
CREATE UNIQUE INDEX IF NOT EXISTS idx_state_snapshots_unique
  ON public.interview_state_snapshots (interview_id, turn_number);

-- M-06 + M-07: dropar tabela nunca populada (tokens ficam no JSONB agent_steps)
DROP TABLE IF EXISTS public.pipeline_token_usage;
