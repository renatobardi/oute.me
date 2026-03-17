import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api-utils';
import { getAvailableTones, getUserActiveTone } from '$lib/server/tones';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	requireAuth(locals);
	const user = locals.dbUser!;

	const [tones, activeTone] = await Promise.all([
		getAvailableTones(),
		getUserActiveTone(user.id),
	]);

	return json({
		tones,
		active_tone_id: activeTone?.id ?? null,
	});
};
