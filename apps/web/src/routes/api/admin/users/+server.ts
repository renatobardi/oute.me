import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllUsers } from '$lib/server/users';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const users = await getAllUsers();
	return Response.json({ users });
};
