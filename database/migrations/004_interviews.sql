-- 004_interviews.sql
-- Tabelas de entrevistas, mensagens e documentos

CREATE TABLE public.interviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       text,
  status      text NOT NULL DEFAULT 'active',
  state       jsonb NOT NULL DEFAULT '{}'::jsonb,
  maturity    numeric(4,3) NOT NULL DEFAULT 0.000,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interviews_user_id ON public.interviews (user_id);
CREATE INDEX idx_interviews_status ON public.interviews (status);

CREATE TRIGGER trg_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Mensagens do chat
CREATE TABLE public.interview_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id  uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  role          text NOT NULL,
  content       text NOT NULL,
  tokens_used   integer DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_interview_created ON public.interview_messages (interview_id, created_at);

-- Documentos anexados
CREATE TABLE public.documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  filename        text NOT NULL,
  mime_type       text NOT NULL,
  storage_path    text NOT NULL,
  extracted_text  text,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_interview ON public.documents (interview_id);
