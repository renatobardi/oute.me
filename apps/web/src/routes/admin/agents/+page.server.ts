import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllInstructions, type AgentInstruction } from '$lib/server/agent-instructions';
import sql from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	let instructions: AgentInstruction[] = [];
	let latestJobId: string | null = null;

	try {
		instructions = await getAllInstructions();
	} catch (err) {
		console.error('[admin/agents] getAllInstructions failed:', err);
	}

	try {
		const rows = await sql<{ job_id: string }[]>`
			SELECT er.job_id FROM public.estimate_runs er
			WHERE er.status = 'done' AND er.job_id IS NOT NULL
			ORDER BY er.completed_at DESC NULLS LAST
			LIMIT 1
		`;
		latestJobId = rows[0]?.job_id ?? null;
	} catch (err) {
		console.error('[admin/agents] latestRun query failed:', err);
	}

	return { instructions, latestJobId };
};
