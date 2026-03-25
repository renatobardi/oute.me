import { BASE_URL } from '../seed-config.js';
import { query, queryOne } from './db-seeder.js';
import type { ProjectDefinition, MilestoneDefinition, MilestoneStatus } from '../data/project-definitions.js';

/**
 * Cria um projeto via API (POST /api/projects).
 * Retorna o project_id criado.
 */
export async function createProject(
  sessionCookie: string,
  estimateId: string,
  name: string,
  selectedScenario: string,
): Promise<string> {
  const resp = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `__session=${sessionCookie}`,
    },
    body: JSON.stringify({
      estimate_id: estimateId,
      name,
      selected_scenario: selectedScenario,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Falha ao criar projeto (${resp.status}): ${body}`);
  }
  const json = (await resp.json()) as { id?: string; project_id?: string };
  return json.id ?? json.project_id ?? '';
}

/**
 * Injeta milestones e tasks no banco para um projeto existente.
 * Limpa milestones/tasks gerados pela API antes de inserir os definidos.
 */
export async function injectProjectMilestones(
  projectId: string,
  definition: ProjectDefinition,
): Promise<void> {
  // Remove milestones gerados automaticamente pela API (se houver)
  await query(
    'DELETE FROM public.tasks WHERE project_id = $1',
    [projectId],
  );
  await query(
    'DELETE FROM public.milestones WHERE project_id = $1',
    [projectId],
  );

  // Insere milestones e tasks conforme definição
  for (let mi = 0; mi < definition.milestones.length; mi++) {
    const m = definition.milestones[mi];
    const milestoneRow = await queryOne<{ id: string }>(
      `INSERT INTO public.milestones
         (id, project_id, name, description, duration_weeks, sort_order, status,
          deliverables, dependencies, started_at, completed_at, created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
       RETURNING id`,
      [
        projectId,
        m.name,
        m.description,
        estimateDurationWeeks(m),
        mi,
        m.status,
        JSON.stringify([]),
        JSON.stringify([]),
        m.status === 'done' ? new Date(Date.now() - m.due_weeks_from_now * -7 * 24 * 3600 * 1000).toISOString() : null,
        m.status === 'done' ? new Date().toISOString() : null,
      ],
    );

    if (!milestoneRow) throw new Error(`Falha ao inserir milestone: ${m.name}`);
    const milestoneId = milestoneRow.id;

    for (let ti = 0; ti < m.tasks.length; ti++) {
      const t = m.tasks[ti];
      await query(
        `INSERT INTO public.tasks
           (id, milestone_id, project_id, title, description, status, priority,
            estimated_hours, sort_order, created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
        [
          milestoneId,
          projectId,
          t.title,
          t.description ?? null,
          t.status,
          t.priority,
          t.estimated_hours,
          ti,
        ],
      );
    }
  }

  // Atualiza status do projeto
  await query(
    'UPDATE public.projects SET status = $1, updated_at = now() WHERE id = $2',
    [definition.status, projectId],
  );

  console.log(`  [project] ${projectId} → ${definition.milestones.length} milestones, status=${definition.status}`);
}

function estimateDurationWeeks(m: MilestoneDefinition): number {
  const totalHours = m.tasks.reduce((acc, t) => acc + t.estimated_hours, 0);
  return Math.max(1, Math.round(totalHours / 40));
}

/**
 * Cria projeto + injeta milestones/tasks em uma operação só.
 */
export async function seedProject(
  sessionCookie: string,
  estimateId: string,
  definition: ProjectDefinition,
): Promise<string> {
  const projectId = await createProject(
    sessionCookie,
    estimateId,
    definition.name,
    definition.selected_scenario,
  );
  await injectProjectMilestones(projectId, definition);
  return projectId;
}
