import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateUserProfile } from '$lib/server/users';

export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || !locals.dbUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';

	if (!full_name) {
		return json({ error: 'full_name é obrigatório' }, { status: 400 });
	}

	const updated = await updateUserProfile(locals.dbUser.id, {
		full_name,
		company: typeof body.company === 'string' ? body.company.trim() || undefined : undefined,
		role: typeof body.role === 'string' ? body.role.trim() || undefined : undefined,
	});

	return json({ user: updated });
};
