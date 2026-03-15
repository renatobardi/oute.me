import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getEstimate, updateEstimateStatus } from '$lib/server/estimates';
import { getJSON } from '$lib/server/ai-client';

interface AiStatusResponse {
	job_id: string;
	status: string;
	result: Record<string, unknown> | null;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const estimate = await getEstimate(params.id, user.uid);

	if (!estimate) {
		return jsonError(404, 'Estimate not found');
	}

	// If still in progress, poll AI service for updates
	if (['pending', 'running'].includes(estimate.status) && estimate.job_id) {
		try {
			const aiStatus = await getJSON<AiStatusResponse>(
				`/estimate/status/${estimate.job_id}`
			);

			if (aiStatus.status !== estimate.status) {
				await updateEstimateStatus(
					estimate.id,
					aiStatus.status,
					aiStatus.result ?? undefined
				);
				estimate.status = aiStatus.status;
				if (aiStatus.result) {
					estimate.result = aiStatus.result as unknown as typeof estimate.result;
				}
			}
		} catch {
			// AI service unavailable — return last known state
		}
	}

	return jsonOk(estimate);
};
