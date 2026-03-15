-- 009_job_state.sql
-- Estado de jobs (fallback do Redis em dev)

CREATE TABLE ai.job_state (
  job_id      text PRIMARY KEY,
  status      text NOT NULL,
  payload     jsonb,
  result      jsonb,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_state_status ON ai.job_state (status);
CREATE INDEX idx_job_state_expires ON ai.job_state (expires_at);
