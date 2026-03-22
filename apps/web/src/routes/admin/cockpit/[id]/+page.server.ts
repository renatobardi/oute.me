import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCockpitInterviewDetail } from '$lib/server/admin-cockpit';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const detail = await getCockpitInterviewDetail(params.id);
	if (!detail) throw error(404, 'Entrevista não encontrada');

	return { detail };
};
