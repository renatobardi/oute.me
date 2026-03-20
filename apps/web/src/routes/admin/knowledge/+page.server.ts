import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllKnowledgeEntries } from '$lib/server/admin-knowledge';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const entries = await getAllKnowledgeEntries();
	return { entries };
};
