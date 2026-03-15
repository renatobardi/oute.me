import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProjectsByUser } from '$lib/server/projects';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const projects = await getProjectsByUser(locals.user.uid);
	return { projects };
};
