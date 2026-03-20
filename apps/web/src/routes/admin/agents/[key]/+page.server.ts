import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getInstruction } from '$lib/server/agent-instructions';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const instruction = await getInstruction(params.key);
	if (!instruction) throw error(404, 'Agent instruction not found');

	return { instruction };
};
