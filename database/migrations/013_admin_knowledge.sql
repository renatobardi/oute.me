-- Migration: 013_admin_knowledge
-- Base de conhecimento administrativa permanente

CREATE TABLE public.admin_knowledge (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type IN ('document', 'url', 'note')),
  title         text NOT NULL,
  content       text NOT NULL,
  original_url  text,
  filename      text,
  mime_type     text,
  storage_path  text,
  is_embedded   boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_knowledge_type ON public.admin_knowledge (type);
CREATE INDEX idx_admin_knowledge_is_embedded ON public.admin_knowledge (is_embedded);

CREATE TRIGGER trg_admin_knowledge_updated_at
  BEFORE UPDATE ON public.admin_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
