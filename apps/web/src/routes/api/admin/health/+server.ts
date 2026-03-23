import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk } from '$lib/server/api-utils';
import { getJSON } from '$lib/server/ai-client';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	try {
		const health = await getJSON<Record<string, string>>('/health/services');
		return jsonOk(health);
	} catch {
		return jsonOk({ postgres: 'error', redis: 'error', vertex_ai: 'error' });
	}
};
