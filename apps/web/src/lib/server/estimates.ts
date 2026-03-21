import sql from './db';
import type { Estimate, EstimateRun } from '$lib/types/estimate';

export async function createEstimate(
	interviewId: string,
	userId: string,
	jobId?: string | null
): Promise<Estimate> {
	const status = jobId ? 'pending' : 'pending_approval';
	const [row] = await sql<Estimate[]>`
		INSERT INTO public.estimates (interview_id, user_id, job_id, status)
		VALUES (${interviewId}, ${userId}, ${jobId ?? null}, ${status})
		RETURNING *
	`;
	return row;
}

export async function getEstimate(
	estimateId: string,
	userId: string
): Promise<Estimate | null> {
	const [row] = await sql<Estimate[]>`
		SELECT * FROM public.estimates
		WHERE id = ${estimateId} AND user_id = ${userId}
	`;
	return row ?? null;
}

export async function getEstimateByJobId(jobId: string): Promise<Estimate | null> {
	const [row] = await sql<Estimate[]>`
		SELECT * FROM public.estimates
		WHERE job_id = ${jobId}
	`;
	return row ?? null;
}

export async function getEstimateByInterview(
	interviewId: string,
	userId: string
): Promise<Estimate | null> {
	const [row] = await sql<Estimate[]>`
		SELECT * FROM public.estimates
		WHERE interview_id = ${interviewId} AND user_id = ${userId}
		ORDER BY created_at DESC
		LIMIT 1
	`;
	return row ?? null;
}

export async function updateEstimateStatus(
	estimateId: string,
	status: string,
	result?: Record<string, unknown>,
	agentSteps?: unknown[]
): Promise<void> {
	if (result && agentSteps) {
		await sql`
			UPDATE public.estimates
			SET status      = ${status},
			    result      = ${sql.json(result as unknown as Record<string, never>)},
			    agent_steps = ${sql.json(agentSteps as unknown as Record<string, never>[])}
			WHERE id = ${estimateId}
		`;
	} else if (result) {
		await sql`
			UPDATE public.estimates
			SET status = ${status},
			    result = ${sql.json(result as unknown as Record<string, never>)}
			WHERE id = ${estimateId}
		`;
	} else {
		await sql`
			UPDATE public.estimates
			SET status = ${status}
			WHERE id = ${estimateId}
		`;
	}
}

export async function updateEstimateJobId(estimateId: string, jobId: string): Promise<void> {
	await sql`
		UPDATE public.estimates
		SET job_id = ${jobId}, status = 'pending', updated_at = now()
		WHERE id = ${estimateId}
	`;
}

export async function approveEstimate(estimateId: string): Promise<void> {
	await sql`
		UPDATE public.estimates
		SET approved_at = now(), status = 'approved'
		WHERE id = ${estimateId}
	`;
}

// ── Estimate Runs (histórico persistente de execuções) ──────────────────────

export async function createEstimateRun(
	estimateId: string,
	jobId: string,
	llmModel: string
): Promise<EstimateRun> {
	const [row] = await sql<EstimateRun[]>`
		INSERT INTO public.estimate_runs (estimate_id, job_id, llm_model, status)
		VALUES (${estimateId}, ${jobId}, ${llmModel}, 'pending')
		RETURNING *
	`;
	return row;
}

export async function getEstimateRuns(estimateId: string): Promise<EstimateRun[]> {
	return sql<EstimateRun[]>`
		SELECT * FROM public.estimate_runs
		WHERE estimate_id = ${estimateId}
		ORDER BY created_at DESC
	`;
}

export async function updateEstimateRun(
	jobId: string,
	status: string,
	opts: {
		agentSteps?: unknown[];
		agentOutputs?: Record<string, unknown>;
		totalDurationS?: number;
		errorMessage?: string;
	} = {}
): Promise<void> {
	const completed = ['done', 'failed'].includes(status) ? sql`now()` : sql`NULL`;
	await sql`
		UPDATE public.estimate_runs
		SET status           = ${status},
		    agent_steps      = ${opts.agentSteps ? sql.json(opts.agentSteps as unknown as Record<string, never>[]) : sql`agent_steps`},
		    agent_outputs    = ${opts.agentOutputs ? sql.json(opts.agentOutputs as unknown as Record<string, never>) : sql`agent_outputs`},
		    total_duration_s = ${opts.totalDurationS ?? null},
		    error_message    = ${opts.errorMessage ?? null},
		    completed_at     = ${completed}
		WHERE job_id = ${jobId}
	`;
}
