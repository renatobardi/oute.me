import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api-utils';
import { setUserActiveTone } from '$lib/server/tones';
import { json, error } from '@sveltejs/kit';

export const PUT: RequestHandler = async ({ locals, request }) => {
	requireAuth(locals);
	const user = locals.dbUser!;

	const body = await request.json();
	const toneId = body.tone_id as string;

	if (!toneId) {
		throw error(400, 'tone_id is required');
	}

	await setUserActiveTone(user.id, toneId);

	return json({ success: true });
};
