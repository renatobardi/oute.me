import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProjectsByUser } from '$lib/server/projects';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.dbUser) {
		throw error(401, 'Authentication required');
	}

	const projects = await getProjectsByUser(locals.dbUser.id);
	return { projects };
};
