import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getEstimateByInterview, createEstimateRun } from '$lib/server/estimates';
import { getDocuments } from '$lib/server/interviews';
import { getJSON, postJSON } from '$lib/server/ai-client';
import { getAllInstructions } from '$lib/server/agent-instructions';
import sql from '$lib/server/db';
import type { Interview } from '$lib/types/interview';

// GET — fetch agent output for a specific agent key
export const GET: RequestHandler = async ({ params, url, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const agentKey = url.searchParams.get('agent');

	// Find the estimate for this interview (any user)
	const [estimateRow] = await sql<{ id: string; job_id: string | null }[]>`
		SELECT id, job_id FROM public.estimates
		WHERE interview_id = ${params.id}
		ORDER BY created_at DESC LIMIT 1
	`;

	if (!estimateRow?.job_id) {
		return jsonError(404, 'No estimate job found for this interview');
	}

	if (agentKey) {
		try {
			const data = await getJSON(`/estimate/status/${estimateRow.job_id}/agent/${agentKey}`);
			return jsonOk(data);
		} catch {
			return jsonError(404, `Output for agent '${agentKey}' not available`);
		}
	}

	// Return full status
	try {
		const data = await getJSON(`/estimate/status/${estimateRow.job_id}`);
		return jsonOk(data);
	} catch {
		return jsonError(502, 'AI service unavailable');
	}
};

// POST — trigger a rerun from admin context (bypasses user ownership)
export const POST: RequestHandler = async ({ params, request, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const body = await request.json().catch(() => ({})) as { llm_model?: string; from_agent?: string };

	const [interviewRow] = await sql<Interview[]>`
		SELECT * FROM public.interviews WHERE id = ${params.id}
	`;
	if (!interviewRow) return jsonError(404, 'Interview not found');

	const [estimateRow] = await sql<{ id: string; job_id: string | null; status: string }[]>`
		SELECT id, job_id, status FROM public.estimates
		WHERE interview_id = ${params.id}
		ORDER BY created_at DESC LIMIT 1
	`;
	if (!estimateRow) return jsonError(404, 'No estimate found for this interview');
	if (['pending', 'running'].includes(estimateRow.status)) {
		return jsonError(400, 'Estimate is already running');
	}

	const docs = await getDocuments(params.id);
	const documents_context = docs
		.filter((d) => d.status === 'completed' && d.extracted_text)
		.map((d) => `[${d.filename}]\n${d.extracted_text}`)
		.join('\n\n---\n\n');

	const instructions = await getAllInstructions();
	const agent_instructions = Object.fromEntries(
		instructions.filter((i) => i.content).map((i) => [i.agent_key, i.content])
	);

	const aiResponse = await postJSON<{ job_id: string; status: string }>('/estimate/rerun', {
		job_id: estimateRow.job_id,
		interview_id: params.id,
		interview_state: interviewRow.state,
		conversation_summary: interviewRow.state?.conversation_summary || '',
		documents_context,
		llm_model: body.llm_model || 'gemini-2.5-flash',
		agent_instructions,
		...(body.from_agent ? { from_agent: body.from_agent } : {}),
	});

	await sql`
		UPDATE public.estimates
		SET job_id = ${aiResponse.job_id}, status = 'pending', updated_at = now()
		WHERE id = ${estimateRow.id}
	`;
	await createEstimateRun(estimateRow.id, aiResponse.job_id, body.llm_model || 'gemini-2.5-flash');

	return jsonOk({ estimate_id: estimateRow.id, job_id: aiResponse.job_id, status: 'pending' });
};
