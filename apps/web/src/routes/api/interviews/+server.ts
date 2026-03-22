import type { RequestHandler } from './$types';
import { requireAuth, jsonOk } from '$lib/server/api-utils';
import { getOrCreateUser } from '$lib/server/users';
import { createInterview, getInterviewsByUser } from '$lib/server/interviews';
import { logBusinessEvent } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, request }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	const body = await request.json().catch(() => ({}));
	const title = typeof body.title === 'string' ? body.title : undefined;

	const interview = await createInterview(user.id, title);
	void logBusinessEvent('interview.created', user.id, 'interview', interview.id);
	return jsonOk({ interview }, 201);
};

export const GET: RequestHandler = async ({ locals }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	const interviews = await getInterviewsByUser(user.id);
	return jsonOk({ interviews });
};
