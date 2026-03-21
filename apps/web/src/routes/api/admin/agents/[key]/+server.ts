import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getInstruction, updateInstruction } from '$lib/server/agent-instructions';

export const GET: RequestHandler = async ({ params, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const instruction = await getInstruction(params.key);
	if (!instruction) return jsonError(404, 'Agent instruction not found');

	return jsonOk(instruction);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const body = await request.json();
	const { content, temperature, max_tokens, enabled } = body as {
		content?: string;
		temperature?: number;
		max_tokens?: number;
		enabled?: boolean;
	};

	if (content !== undefined && typeof content !== 'string') {
		return jsonError(400, 'content must be a string');
	}

	const updated = await updateInstruction(params.key, { content, temperature, max_tokens, enabled }, user.uid);
	if (!updated) return jsonError(404, 'Agent instruction not found');

	return jsonOk(updated);
};
