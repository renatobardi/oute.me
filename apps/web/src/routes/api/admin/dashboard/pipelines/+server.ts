import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getActivePipelines } from '$lib/server/admin-dashboard';

export const GET: RequestHandler = async ({ locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const pipelines = await getActivePipelines();
	return jsonOk(pipelines);
};
