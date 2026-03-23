-- 020_interview_state_snapshots.sql
-- Histórico de maturity score por turno para timeline visual no admin

CREATE TABLE public.interview_state_snapshots (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  message_id   uuid REFERENCES public.interview_messages(id) ON DELETE SET NULL,
  turn_number  int  NOT NULL,
  maturity     numeric(4,3) NOT NULL,
  domains      jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_state_snapshots_interview ON public.interview_state_snapshots (interview_id, turn_number);

COMMENT ON TABLE public.interview_state_snapshots IS
  'Snapshot do estado de maturidade a cada turno do chat. '
  'Permite renderizar timeline de evolução da entrevista no admin.';
