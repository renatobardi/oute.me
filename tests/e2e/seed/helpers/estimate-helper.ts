import { BASE_URL } from '../seed-config.js';
import { query, queryOne, generateJobId } from './db-seeder.js';
import type { EstimateResult, AgentStep } from '../data/estimate-results.js';

export type EstimateStatus =
  | 'pending'
  | 'pending_approval'
  | 'running'
  | 'done'
  | 'failed'
  | 'approved';

/**
 * Dispara uma estimativa via API (POST /api/estimates).
 * Retorna o estimate_id criado.
 */
export async function triggerEstimate(
  sessionCookie: string,
  interviewId: string,
): Promise<string> {
  const resp = await fetch(`${BASE_URL}/api/estimates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `__session=${sessionCookie}`,
    },
    body: JSON.stringify({ interview_id: interviewId }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Falha ao disparar estimativa (${resp.status}): ${body}`);
  }
  const json = (await resp.json()) as { id?: string; estimate_id?: string };
  return json.id ?? json.estimate_id ?? '';
}

/**
 * Injeta result + status direto no banco (bypassa o pipeline CrewAI lento).
 * Também cria o estimate_run com agent_steps mockados.
 */
export async function injectEstimateResult(
  estimateId: string,
  status: EstimateStatus,
  result: EstimateResult | null,
  agentSteps: AgentStep[],
  errorMessage?: string,
): Promise<void> {
  const jobId = generateJobId();
  const now = new Date();

  // Determina timestamps
  const approvedAt = status === 'approved' ? now.toISOString() : null;

  // Calcula duração total dos steps completos
  const totalDuration = agentSteps
    .filter((s) => s.duration_s !== null)
    .reduce((acc, s) => acc + (s.duration_s ?? 0), 0);

  const completedAt = ['done', 'approved', 'failed'].includes(status) ? now : null;

  // Determina status do estimate_run
  const runStatus = status === 'approved' ? 'done' : status === 'pending_approval' ? 'done' : status;

  // Atualiza estimate
  await query(
    `UPDATE public.estimates
     SET status = $1,
         result = $2,
         job_id = $3,
         approved_at = $4,
         agent_steps = $5,
         updated_at = now()
     WHERE id = $6`,
    [
      status === 'approved' ? 'approved' : status,
      result ? JSON.stringify(result) : null,
      jobId,
      approvedAt,
      JSON.stringify(agentSteps),
      estimateId,
    ],
  );

  // Insere estimate_run
  await query(
    `INSERT INTO public.estimate_runs
       (id, estimate_id, job_id, status, llm_model, agent_steps, agent_outputs,
        total_duration_s, error_message, created_at, completed_at)
     VALUES
       (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      estimateId,
      jobId,
      runStatus,
      'vertex_ai/gemini-2.5-flash-lite',
      JSON.stringify(agentSteps),
      JSON.stringify({}),
      totalDuration > 0 ? totalDuration : null,
      errorMessage ?? null,
      now.toISOString(),
      completedAt?.toISOString() ?? null,
    ],
  );

  console.log(`  [estimate] ${estimateId} → status=${status}, steps=${agentSteps.length}`);
}

/**
 * Busca o estimate_id pelo interview_id.
 */
export async function getEstimateByInterview(
  interviewId: string,
): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    'SELECT id FROM public.estimates WHERE interview_id = $1 ORDER BY created_at DESC LIMIT 1',
    [interviewId],
  );
  return row?.id ?? null;
}

/**
 * Cria uma estimativa diretamente no banco (para cenários que não passam pela UI).
 */
export async function createEstimateDirect(
  userId: string,
  interviewId: string,
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO public.estimates (id, interview_id, user_id, status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'pending', now(), now())
     RETURNING id`,
    [interviewId, userId],
  );
  if (!row) throw new Error('Falha ao criar estimate direto no banco');
  return row.id;
}
