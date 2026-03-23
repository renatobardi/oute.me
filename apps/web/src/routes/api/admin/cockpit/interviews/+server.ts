import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk } from '$lib/server/api-utils';
import { getAllInterviewsForAdmin } from '$lib/server/admin-cockpit';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const interviews = await getAllInterviewsForAdmin();
	return jsonOk(interviews);
};
