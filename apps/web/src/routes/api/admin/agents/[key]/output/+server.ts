import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk, jsonError } from '$lib/server/api-utils';
import { getJSON } from '$lib/server/ai-client';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const jobId = url.searchParams.get('job_id');
	if (!jobId) return jsonError(400, 'job_id query param is required');

	try {
		const data = await getJSON(`/estimate/status/${jobId}/agent/${params.key}`);
		return jsonOk(data);
	} catch {
		return jsonError(404, `Output for agent '${params.key}' not available`);
	}
};
