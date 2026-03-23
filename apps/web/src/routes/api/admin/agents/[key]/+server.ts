import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk, jsonError } from '$lib/server/api-utils';
import { getInstruction, updateInstruction } from '$lib/server/agent-instructions';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const instruction = await getInstruction(params.key);
	if (!instruction) return jsonError(404, 'Agent instruction not found');

	return jsonOk(instruction);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');
	const user = locals.user;

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
