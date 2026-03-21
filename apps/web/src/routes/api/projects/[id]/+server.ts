import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getProject, getMilestones, getTasks, updateProjectStatus } from '$lib/server/projects';

export const GET: RequestHandler = async ({ params, locals }) => {
	requireAuth(locals);
	const project = await getProject(params.id, locals.dbUser!.id);

	if (!project) {
		return jsonError(404, 'Project not found');
	}

	const milestones = await getMilestones(project.id);
	const tasks = await getTasks(project.id);

	return jsonOk({ project, milestones, tasks });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	requireAuth(locals);
	const project = await getProject(params.id, locals.dbUser!.id);

	if (!project) {
		return jsonError(404, 'Project not found');
	}

	const body = await request.json();
	const { status } = body as { status: string };

	if (status && ['active', 'paused', 'completed', 'cancelled'].includes(status)) {
		await updateProjectStatus(project.id, status);
	}

	return jsonOk({ status: 'updated' });
};
