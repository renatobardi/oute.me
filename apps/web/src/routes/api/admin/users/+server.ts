import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllUsers } from '$lib/server/users';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.dbUser?.is_admin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const users = await getAllUsers();
	return json({ users });
};
