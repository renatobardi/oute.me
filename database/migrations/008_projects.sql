-- 008_projects.sql
-- Projetos, milestones e tasks criados a partir de estimativas aprovadas

CREATE TABLE public.projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id     uuid NOT NULL REFERENCES public.estimates(id),
  user_id         uuid NOT NULL REFERENCES public.users(id),
  name            text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'active',
  selected_scenario text NOT NULL DEFAULT 'moderado',
  total_cost      numeric(12,2),
  total_hours     numeric(10,1),
  duration_weeks  int,
  team_size       int,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user ON public.projects (user_id);
CREATE INDEX idx_projects_estimate ON public.projects (estimate_id);
CREATE INDEX idx_projects_status ON public.projects (status);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  duration_weeks  int NOT NULL DEFAULT 1,
  sort_order      int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending',
  deliverables    jsonb NOT NULL DEFAULT '[]',
  dependencies    jsonb NOT NULL DEFAULT '[]',
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestones_project ON public.milestones (project_id);

CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id    uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'todo',
  priority        text NOT NULL DEFAULT 'medium',
  estimated_hours numeric(6,1),
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_milestone ON public.tasks (milestone_id);
CREATE INDEX idx_tasks_project ON public.tasks (project_id);
CREATE INDEX idx_tasks_status ON public.tasks (status);

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
