import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getJSON } from '$lib/server/ai-client';

export const GET: RequestHandler = async ({ locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	try {
		const health = await getJSON<Record<string, string>>('/health/services');
		return jsonOk(health);
	} catch {
		return jsonOk({ postgres: 'error', redis: 'error', vertex_ai: 'error' });
	}
};
