import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk, jsonError, validateUuid } from '$lib/server/api-utils';
import { getCockpitInterviewDetail } from '$lib/server/admin-cockpit';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');
	validateUuid(params.id);

	const detail = await getCockpitInterviewDetail(params.id);
	if (!detail) return jsonError(404, 'Interview not found');

	return jsonOk(detail);
};
