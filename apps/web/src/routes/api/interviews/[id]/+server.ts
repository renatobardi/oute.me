import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getOrCreateUser } from '$lib/server/users';
import { getInterview, getMessages, getDocuments, updateInterviewTitle, updateInterviewStatus } from '$lib/server/interviews';

const VALID_STATUSES = ['active', 'archived'];

export const GET: RequestHandler = async ({ locals, params }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	const interview = await getInterview(params.id, user.id);
	if (!interview) {
		return jsonError(404, 'Interview not found');
	}

	const [messages, documents] = await Promise.all([
		getMessages(params.id),
		getDocuments(params.id),
	]);

	return jsonOk({ interview, messages, documents });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	const interview = await getInterview(params.id, user.id);
	if (!interview) {
		return jsonError(404, 'Interview not found');
	}

	const body = await request.json();

	if ('status' in body) {
		const status = body.status as string;
		if (!VALID_STATUSES.includes(status)) {
			return jsonError(400, 'Invalid status');
		}
		await updateInterviewStatus(params.id, status);
		return jsonOk({ status });
	}

	const title = body.title as string;
	if (!title?.trim()) {
		return jsonError(400, 'Title is required');
	}

	await updateInterviewTitle(params.id, title.trim());
	return jsonOk({ title: title.trim() });
};
