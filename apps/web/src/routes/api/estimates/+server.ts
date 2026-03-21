import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getInterview, getDocuments } from '$lib/server/interviews';
import { createEstimate, getEstimateByInterview, createEstimateRun } from '$lib/server/estimates';
import { postJSON } from '$lib/server/ai-client';
import { getAllInstructions } from '$lib/server/agent-instructions';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	const body = await request.json();
	const { interview_id, llm_model } = body as { interview_id: string; llm_model?: string };

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
	if (existing && ['pending', 'running'].includes(existing.status)) {
		return jsonOk({ id: existing.id, job_id: existing.job_id, status: existing.status });
	}

	// Fetch actual document texts for the interview
	const docs = await getDocuments(interview_id);
	const documents_context = docs
		.filter((d) => d.status === 'completed' && d.extracted_text)
		.map((d) => `[${d.filename}]\n${d.extracted_text}`)
		.join('\n\n---\n\n');

	// Fetch editable agent instructions from admin panel
	const instructions = await getAllInstructions();
	const agent_instructions = Object.fromEntries(
		instructions.filter((i) => i.content).map((i) => [i.agent_key, i.content])
	);
	const agent_config = Object.fromEntries(
		instructions.map((i) => [
			i.agent_key,
			{ temperature: i.temperature ?? 0.7, max_tokens: i.max_tokens ?? 4096 },
		])
	);

	let aiResponse: { job_id: string; status: string };
	try {
		aiResponse = await postJSON<{ job_id: string; status: string }>('/estimate/run', {
			interview_id,
			state: interview.state,
			conversation_summary: interview.state.conversation_summary || '',
			documents_context,
			llm_model: llm_model || 'gemini-2.5-flash',
			agent_instructions,
			agent_config,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'AI service unavailable';
		return jsonError(502, msg);
	}

	const estimate = await createEstimate(interview_id, locals.dbUser!.id, aiResponse.job_id);
	// Non-blocking — if migration 016 hasn't run yet this must not block estimate creation
	createEstimateRun(estimate.id, aiResponse.job_id, llm_model || 'gemini-2.5-flash').catch(() => null);

	return jsonOk({ id: estimate.id, job_id: aiResponse.job_id, status: 'pending' }, 201);
};
