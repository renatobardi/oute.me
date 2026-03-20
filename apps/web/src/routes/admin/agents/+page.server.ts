import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllInstructions } from '$lib/server/agent-instructions';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const instructions = await getAllInstructions();
	return { instructions };
};
