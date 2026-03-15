import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProject, getMilestones, getTasks } from '$lib/server/projects';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const project = await getProject(params.id, locals.user.uid);
	if (!project) {
		throw error(404, 'Project not found');
	}

	const milestones = await getMilestones(project.id);
	const tasks = await getTasks(project.id);

	return { project, milestones, tasks };
};
