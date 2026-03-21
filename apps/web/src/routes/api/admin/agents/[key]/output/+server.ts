import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getJSON } from '$lib/server/ai-client';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const jobId = url.searchParams.get('job_id');
	if (!jobId) return jsonError(400, 'job_id query param is required');

	try {
		const data = await getJSON(`/estimate/status/${jobId}/agent/${params.key}`);
		return jsonOk(data);
	} catch {
		return jsonError(404, `Output for agent '${params.key}' not available`);
	}
};
