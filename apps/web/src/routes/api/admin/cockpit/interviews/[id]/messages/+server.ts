import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk } from '$lib/server/api-utils';
import { getInterviewMessages } from '$lib/server/admin-cockpit';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);

	const result = await getInterviewMessages(params.id, offset, limit);
	return jsonOk(result);
};
