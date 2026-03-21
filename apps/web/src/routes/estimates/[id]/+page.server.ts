import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEstimate, updateEstimateStatus, updateEstimateRun } from '$lib/server/estimates';
import { getProjectByEstimate } from '$lib/server/projects';
import { getJSON } from '$lib/server/ai-client';
import type { AgentStep } from '$lib/types/estimate';

interface AiStatusResponse {
	job_id: string;
	status: string;
	result: Record<string, unknown> | null;
	agent_steps: AgentStep[];
}

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const estimate = await getEstimate(params.id, locals.dbUser!.id);
	if (!estimate) {
		throw error(404, 'Estimate not found');
	}

	// Poll AI service for status updates
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
				if (['done', 'failed'].includes(aiStatus.status) && estimate.job_id) {
					const totalDurationS = (aiStatus.agent_steps ?? []).reduce(
						(sum, s) => sum + (s.duration_s ?? 0),
						0
					);
					await updateEstimateRun(estimate.job_id, aiStatus.status, {
						agentSteps: aiStatus.agent_steps ?? [],
						totalDurationS: totalDurationS > 0 ? totalDurationS : undefined,
						errorMessage: aiStatus.status === 'failed' ? 'Pipeline failed' : undefined,
					}).catch(() => null);
				}
				estimate.status = aiStatus.status;
				if (aiStatus.result) {
					estimate.result = aiStatus.result as unknown as typeof estimate.result;
				}
				estimate.agent_steps = aiStatus.agent_steps ?? [];
			}
		} catch {
			// AI service unavailable — show last known state
		}
	}

	const project = await getProjectByEstimate(estimate.id, locals.dbUser?.id ?? "").catch(() => null);

	return { estimate, project: project ? { id: project.id, name: project.name } : null };
};
