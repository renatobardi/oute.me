-- 006_estimates.sql
-- Tabela de estimativas

CREATE TABLE public.estimates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id),
  status          text NOT NULL DEFAULT 'pending',
  job_id          text UNIQUE,
  result          jsonb,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_estimates_interview ON public.estimates (interview_id);
CREATE INDEX idx_estimates_user ON public.estimates (user_id);
CREATE INDEX idx_estimates_status ON public.estimates (status);

CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
