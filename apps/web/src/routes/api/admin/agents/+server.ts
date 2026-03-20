import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getAllInstructions } from '$lib/server/agent-instructions';

export const GET: RequestHandler = async ({ locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const instructions = await getAllInstructions();
	return jsonOk(instructions);
};
