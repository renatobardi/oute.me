import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { updateKnowledgeEntry, deleteKnowledgeEntry } from '$lib/server/admin-knowledge';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const body = await request.json();
	const { title, content, original_url } = body as {
		title: string;
		content: string;
		original_url?: string | null;
	};

	if (!title || !content) return jsonError(400, 'title and content are required');

	const entry = await updateKnowledgeEntry(params.id, {
		title,
		content,
		original_url: original_url ?? null,
	});
	return jsonOk(entry);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	await deleteKnowledgeEntry(params.id);
	return jsonOk({ deleted: true });
};
