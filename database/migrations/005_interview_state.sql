-- 005_interview_state.sql
-- Indexes JSONB para queries no state da entrevista

CREATE INDEX idx_interviews_state ON public.interviews USING gin (state jsonb_path_ops);
CREATE INDEX idx_interviews_maturity ON public.interviews (maturity);
