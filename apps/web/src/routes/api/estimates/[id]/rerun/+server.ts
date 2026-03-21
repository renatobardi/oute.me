import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getEstimate, updateEstimateJobId, createEstimateRun } from '$lib/server/estimates';
import { getInterview, getDocuments } from '$lib/server/interviews';
import { postJSON } from '$lib/server/ai-client';
import { getAllInstructions } from '$lib/server/agent-instructions';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const estimate = await getEstimate(params.id, user.uid);

	if (!estimate) {
		return jsonError(404, 'Estimate not found');
	}

	if (['pending', 'running'].includes(estimate.status)) {
		return jsonError(400, 'Estimate is already running');
	}

	const body = await request.json().catch(() => ({})) as { from_agent?: string; llm_model?: string };

	const interview = await getInterview(estimate.interview_id, user.uid);
	if (!interview) {
		return jsonError(404, 'Interview not found');
	}

	const docs = await getDocuments(estimate.interview_id);
	const documents_context = docs
		.filter((d) => d.status === 'completed' && d.extracted_text)
		.map((d) => `[${d.filename}]\n${d.extracted_text}`)
		.join('\n\n---\n\n');

	const instructions = await getAllInstructions();
	const agent_instructions = Object.fromEntries(
		instructions.filter((i) => i.content).map((i) => [i.agent_key, i.content])
	);

	const aiResponse = await postJSON<{ job_id: string; status: string }>('/estimate/rerun', {
		job_id: estimate.job_id,
		interview_id: estimate.interview_id,
		interview_state: interview.state,
		conversation_summary: interview.state.conversation_summary || '',
		documents_context,
		llm_model: body.llm_model || 'gemini-2.5-flash',
		agent_instructions,
		...(body.from_agent ? { from_agent: body.from_agent } : {}),
	});

	await updateEstimateJobId(estimate.id, aiResponse.job_id);
	await createEstimateRun(estimate.id, aiResponse.job_id, body.llm_model || 'gemini-2.5-flash');

	return jsonOk({ id: estimate.id, job_id: aiResponse.job_id, status: 'pending' });
};
