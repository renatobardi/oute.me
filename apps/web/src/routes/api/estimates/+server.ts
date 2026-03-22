import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getInterview } from '$lib/server/interviews';
import { createEstimate, getEstimateByInterview } from '$lib/server/estimates';
import { logBusinessEvent } from '$lib/server/audit';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAuth(locals);
	const body = await request.json();
	const { interview_id } = body as { interview_id: string };

	if (!interview_id) {
		return jsonError(400, 'interview_id is required');
	}

	const interview = await getInterview(interview_id, locals.dbUser!.id);
	if (!interview) {
		return jsonError(404, 'Interview not found');
	}

	if (interview.maturity < 0.7) {
		return jsonError(400, 'Interview maturity must be at least 0.70');
	}

	const existing = await getEstimateByInterview(interview_id, locals.dbUser!.id);
	if (existing && ['pending_approval', 'pending', 'running'].includes(existing.status)) {
		return jsonOk({ id: existing.id, status: existing.status });
	}

	// Create estimate awaiting admin approval — pipeline starts only after admin triggers it
	const estimate = await createEstimate(interview_id, locals.dbUser!.id);
	void logBusinessEvent('estimate.triggered', locals.dbUser!.id, 'interview', interview_id, {
		estimate_id: estimate.id,
	});

	return jsonOk({ id: estimate.id, status: 'pending_approval' }, 201);
};
