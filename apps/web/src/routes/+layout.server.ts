import type { LayoutServerLoad } from './$types';
import { isAdminEmail } from '$lib/server/users';

export const load: LayoutServerLoad = async ({ locals }) => {
	const email = locals.dbUser?.email ?? '';
	const isAdmin = (locals.dbUser?.is_admin ?? false) || isAdminEmail(email);
	return { isAdmin };
};
