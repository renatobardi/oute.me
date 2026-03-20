import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getInterviewMessages } from '$lib/server/admin-cockpit';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);

	const result = await getInterviewMessages(params.id, offset, limit);
	return jsonOk(result);
};
