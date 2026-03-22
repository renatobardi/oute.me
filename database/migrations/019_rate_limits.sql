-- 019_rate_limits.sql
-- Rate limiting persistente via PostgreSQL (sobrevive a cold starts do Cloud Run)

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key              TEXT        PRIMARY KEY,
  last_request_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup de entries antigas (> 1 hora)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON public.rate_limits (last_request_at);

COMMENT ON TABLE public.rate_limits IS 'Persistent rate limit state — survives Cloud Run scale-to-zero';
