import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getProject, updateMilestoneStatus } from '$lib/server/projects';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const project = await getProject(params.id, user.uid);

	if (!project) {
		return jsonError(404, 'Project not found');
	}

	const body = await request.json();
	const { status } = body as { status: string };

	if (status && ['pending', 'in_progress', 'done'].includes(status)) {
		await updateMilestoneStatus(params.milestoneId, status);
	}

	return jsonOk({ status: 'updated' });
};
