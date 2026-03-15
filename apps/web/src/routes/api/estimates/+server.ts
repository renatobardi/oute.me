import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getInterview } from '$lib/server/interviews';
import { createEstimate, getEstimateByInterview } from '$lib/server/estimates';
import { postJSON } from '$lib/server/ai-client';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	const body = await request.json();
	const { interview_id } = body as { interview_id: string };

	if (!interview_id) {
		return jsonError(400, 'interview_id is required');
	}

	const interview = await getInterview(interview_id, user.uid);
	if (!interview) {
		return jsonError(404, 'Interview not found');
	}

	if (interview.maturity < 0.7) {
		return jsonError(400, 'Interview maturity must be at least 0.70');
	}

	const existing = await getEstimateByInterview(interview_id, user.uid);
	if (existing && ['pending', 'running'].includes(existing.status)) {
		return jsonOk({ id: existing.id, job_id: existing.job_id, status: existing.status });
	}

	const aiResponse = await postJSON<{ job_id: string; status: string }>('/estimate/run', {
		interview_id,
		state: interview.state,
		conversation_summary: interview.state.conversation_summary || '',
		documents_context: '',
	});

	const estimate = await createEstimate(interview_id, user.uid, aiResponse.job_id);

	return jsonOk({ id: estimate.id, job_id: aiResponse.job_id, status: 'pending' }, 201);
};
