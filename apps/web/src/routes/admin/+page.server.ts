import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllUsers } from '$lib/server/users';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const users = await getAllUsers();
	return { users };
};
