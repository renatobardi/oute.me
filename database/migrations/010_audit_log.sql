-- 010_audit_log.sql
-- Audit log imutável para eventos de segurança e negócio

CREATE TABLE audit.event_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type      text NOT NULL,
  actor_id        uuid REFERENCES public.users(id),
  resource_type   text NOT NULL,
  resource_id     uuid,
  details         jsonb NOT NULL DEFAULT '{}',
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_event_type ON audit.event_log (event_type);
CREATE INDEX idx_audit_actor ON audit.event_log (actor_id);
CREATE INDEX idx_audit_resource ON audit.event_log (resource_type, resource_id);
CREATE INDEX idx_audit_created_at ON audit.event_log (created_at);

-- Prevent updates and deletes on audit log
CREATE OR REPLACE FUNCTION audit.prevent_modify()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is immutable. Updates and deletes are not allowed.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON audit.event_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.prevent_modify();

CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON audit.event_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.prevent_modify();

COMMENT ON TABLE audit.event_log IS 'Immutable audit trail for security and business events';
