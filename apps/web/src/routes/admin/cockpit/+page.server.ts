import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllInterviewsForAdmin } from '$lib/server/admin-cockpit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const interviews = await getAllInterviewsForAdmin();
	return { interviews };
};
