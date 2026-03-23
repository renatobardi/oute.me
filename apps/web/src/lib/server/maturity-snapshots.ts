import sql from './db';
import type { InterviewState } from '$lib/types/interview';

export interface MaturitySnapshot {
	id: string;
	turn_number: number;
	maturity: number;
	domains: Record<string, { answered: number; total: number; vital_answered: boolean }>;
	created_at: string;
}

export async function saveMaturitySnapshot(
	interviewId: string,
	turnNumber: number,
	maturity: number,
	state: InterviewState
): Promise<void> {
	try {
		const domains: Record<string, { answered: number; total: number; vital_answered: boolean }> = {};
		for (const [key, domain] of Object.entries(state.domains ?? {})) {
			domains[key] = {
				answered: (domain as { answered: number }).answered ?? 0,
				total: (domain as { total: number }).total ?? 0,
				vital_answered: (domain as { vital_answered: boolean }).vital_answered ?? false,
			};
		}

		await sql`
			INSERT INTO public.interview_state_snapshots (interview_id, turn_number, maturity, domains)
			VALUES (${interviewId}, ${turnNumber}, ${maturity}, ${sql.json(domains)})
			ON CONFLICT DO NOTHING
		`;
	} catch {
		// Never let snapshot saving break the request
	}
}

export async function getMaturitySnapshots(interviewId: string): Promise<MaturitySnapshot[]> {
	return sql<MaturitySnapshot[]>`
		SELECT id, turn_number, maturity::float AS maturity, domains, created_at
		FROM public.interview_state_snapshots
		WHERE interview_id = ${interviewId}
		ORDER BY turn_number ASC
	`;
}
