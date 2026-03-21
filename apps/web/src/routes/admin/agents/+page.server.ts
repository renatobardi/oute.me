import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllInstructions } from '$lib/server/agent-instructions';
import sql from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const [instructions, latestRunRow] = await Promise.all([
		getAllInstructions(),
		sql<{ job_id: string }[]>`
			SELECT er.job_id FROM public.estimate_runs er
			WHERE er.status = 'done' AND er.job_id IS NOT NULL
			ORDER BY er.completed_at DESC NULLS LAST
			LIMIT 1
		`.then((rows) => rows[0] ?? null),
	]);

	return { instructions, latestJobId: latestRunRow?.job_id ?? null };
};
