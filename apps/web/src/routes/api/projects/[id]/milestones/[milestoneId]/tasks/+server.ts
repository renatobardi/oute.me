import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getProject, createTask, updateTaskStatus } from '$lib/server/projects';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const project = await getProject(params.id, user.uid);

	if (!project) {
		return jsonError(404, 'Project not found');
	}

	const body = await request.json();
	const { title, description, estimated_hours, priority } = body as {
		title: string;
		description?: string;
		estimated_hours?: number;
		priority?: string;
	};

	if (!title) {
		return jsonError(400, 'title is required');
	}

	const task = await createTask(
		params.milestoneId,
		project.id,
		title,
		description,
		estimated_hours,
		priority
	);

	return jsonOk(task, 201);
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const project = await getProject(params.id, user.uid);

	if (!project) {
		return jsonError(404, 'Project not found');
	}

	const body = await request.json();
	const { task_id, status } = body as { task_id: string; status: string };

	if (task_id && status && ['todo', 'in_progress', 'done'].includes(status)) {
		await updateTaskStatus(task_id, status);
	}

	return jsonOk({ status: 'updated' });
};
