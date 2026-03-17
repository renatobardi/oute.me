import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api-utils';
import { getOrCreateUser } from '$lib/server/users';
import { setUserActiveTone } from '$lib/server/tones';
import { json, error } from '@sveltejs/kit';

export const PUT: RequestHandler = async ({ locals, request }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	const body = await request.json();
	const toneId = body.tone_id as string;

	if (!toneId) {
		throw error(400, 'tone_id is required');
	}

	await setUserActiveTone(user.id, toneId);

	return json({ success: true });
};
