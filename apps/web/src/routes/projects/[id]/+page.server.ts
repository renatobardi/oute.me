import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProject, getMilestones, getTasks, getProjectDocuments } from '$lib/server/projects';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user || !locals.dbUser) {
		throw error(401, 'Authentication required');
	}

	const project = await getProject(params.id, locals.dbUser.id);
	if (!project) {
		throw error(404, 'Project not found');
	}

	const [milestones, tasks, documents] = await Promise.all([
		getMilestones(project.id),
		getTasks(project.id),
		getProjectDocuments(project.id),
	]);

	return { project, milestones, tasks, documents };
};
