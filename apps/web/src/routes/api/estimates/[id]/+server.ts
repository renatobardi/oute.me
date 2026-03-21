import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getEstimate, updateEstimateStatus } from '$lib/server/estimates';
import { getJSON } from '$lib/server/ai-client';
import type { AgentStep } from '$lib/types/estimate';

interface AiStatusResponse {
	job_id: string;
	status: string;
	result: Record<string, unknown> | null;
	agent_steps: AgentStep[];
}

export const GET: RequestHandler = async ({ params, locals }) => {
	requireAuth(locals);
	const estimate = await getEstimate(params.id, locals.dbUser!.id);

	if (!estimate) {
		return jsonError(404, 'Estimate not found');
	}

	// If still in progress, poll AI service for updates
	if (['pending', 'running'].includes(estimate.status) && estimate.job_id) {
		try {
			const aiStatus = await getJSON<AiStatusResponse>(
				`/estimate/status/${estimate.job_id}`
			);

			if (aiStatus.status !== estimate.status || aiStatus.agent_steps?.length) {
				await updateEstimateStatus(
					estimate.id,
					aiStatus.status,
					aiStatus.result ?? undefined,
					aiStatus.agent_steps ?? []
				);
				estimate.status = aiStatus.status;
				if (aiStatus.result) {
					estimate.result = aiStatus.result as unknown as typeof estimate.result;
				}
				estimate.agent_steps = aiStatus.agent_steps ?? [];
			}
		} catch {
			// AI service unavailable — return last known state
		}
	}

	return jsonOk(estimate);
};
