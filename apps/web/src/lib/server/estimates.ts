import sql from './db';
import type { Estimate } from '$lib/types/estimate';

export async function createEstimate(
	interviewId: string,
	userId: string,
	jobId: string
): Promise<Estimate> {
	const [row] = await sql<Estimate[]>`
		INSERT INTO public.estimates (interview_id, user_id, job_id, status)
		VALUES (${interviewId}, ${userId}, ${jobId}, 'pending')
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
	result?: Record<string, unknown>
): Promise<void> {
	if (result) {
		await sql`
			UPDATE public.estimates
			SET status = ${status}, result = ${sql.json(result as unknown as Record<string, never>)}
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

export async function approveEstimate(estimateId: string): Promise<void> {
	await sql`
		UPDATE public.estimates
		SET approved_at = now(), status = 'approved'
		WHERE id = ${estimateId}
	`;
}
