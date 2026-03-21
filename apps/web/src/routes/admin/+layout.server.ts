import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdminEmail } from '$lib/server/users';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const isAdmin = (locals.dbUser?.is_admin ?? false) || isAdminEmail(locals.dbUser?.email ?? '');
	if (!isAdmin) throw redirect(302, '/interviews');
	return {};
};
