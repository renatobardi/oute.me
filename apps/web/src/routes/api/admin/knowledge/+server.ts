import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import {
	getAllKnowledgeEntries,
	createKnowledgeEntry,
	markAsEmbedded,
} from '$lib/server/admin-knowledge';
import { postJSON } from '$lib/server/ai-client';

export const GET: RequestHandler = async ({ locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const entries = await getAllKnowledgeEntries();
	return jsonOk(entries);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const body = await request.json();
	const { type, title, content, original_url } = body as {
		type: 'note' | 'url';
		title: string;
		content: string;
		original_url?: string;
	};

	if (!type || !title || !content) {
		return jsonError(400, 'type, title, and content are required');
	}

	const entry = await createKnowledgeEntry({
		type,
		title,
		content,
		original_url: original_url ?? null,
		created_by: user.uid,
	});

	// Embed in vector store (best-effort)
	try {
		await postJSON('/knowledge/embed', {
			id: entry.id,
			content: entry.content,
			metadata: { type: entry.type, title: entry.title, original_url: entry.original_url },
		});
		await markAsEmbedded(entry.id);
		entry.is_embedded = true;
	} catch {
		// Embedding failed — entry is still saved, just not embedded yet
	}

	return jsonOk(entry, 201);
};
