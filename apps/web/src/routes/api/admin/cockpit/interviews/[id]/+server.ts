import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getCockpitInterviewDetail } from '$lib/server/admin-cockpit';

export const GET: RequestHandler = async ({ params, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const detail = await getCockpitInterviewDetail(params.id);
	if (!detail) return jsonError(404, 'Interview not found');

	return jsonOk(detail);
};
