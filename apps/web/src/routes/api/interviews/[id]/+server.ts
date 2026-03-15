import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getOrCreateUser } from '$lib/server/users';
import { getInterview, getMessages, getDocuments } from '$lib/server/interviews';

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
