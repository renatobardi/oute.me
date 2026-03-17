import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.onboarding_complete) throw redirect(302, '/onboarding');
	if (locals.dbUser?.active) throw redirect(302, '/interviews');

	return {
		emailVerified: locals.dbUser?.email_verified ?? false,
		email: locals.user.email,
	};
};
