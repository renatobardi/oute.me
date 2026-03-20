import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getAllInterviewsForAdmin } from '$lib/server/admin-cockpit';

export const GET: RequestHandler = async ({ locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const interviews = await getAllInterviewsForAdmin();
	return jsonOk(interviews);
};
