import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { deleteKnowledgeEntry } from '$lib/server/admin-knowledge';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	await deleteKnowledgeEntry(params.id);
	return jsonOk({ deleted: true });
};
