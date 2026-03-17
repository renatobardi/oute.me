import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (locals.dbUser?.onboarding_complete) throw redirect(302, '/interviews');

	return { email: locals.user.email };
};
