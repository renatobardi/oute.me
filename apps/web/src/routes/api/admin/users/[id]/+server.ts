import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setUserActive } from '$lib/server/users';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.dbUser?.is_admin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await request.json();
	if (typeof body.active !== 'boolean') {
		return json({ error: 'Campo "active" (boolean) é obrigatório' }, { status: 400 });
	}

	const updated = await setUserActive(params.id, body.active);
	return json({ user: updated });
};
