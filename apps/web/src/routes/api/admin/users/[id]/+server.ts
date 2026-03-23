import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setUserActive } from '$lib/server/users';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const body = await request.json();
	if (typeof body.active !== 'boolean') {
		return Response.json({ error: 'Campo "active" (boolean) é obrigatório' }, { status: 400 });
	}

	const updated = await setUserActive(params.id, body.active);
	return Response.json({ user: updated });
};
