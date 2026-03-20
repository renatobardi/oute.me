import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { createKnowledgeEntry, markAsEmbedded } from '$lib/server/admin-knowledge';
import { postFile, postJSON } from '$lib/server/ai-client';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const title = formData.get('title') as string | null;

	if (!file || !title) {
		return jsonError(400, 'file and title are required');
	}

	// Extract text from document via FastAPI
	const extracted = await postFile('/chat/process-document', file, file.name);

	if (extracted.status !== 'completed') {
		return jsonError(422, 'Failed to extract text from document');
	}

	const entry = await createKnowledgeEntry({
		type: 'document',
		title,
		content: extracted.extracted_text,
		filename: file.name,
		mime_type: file.type,
		created_by: user.uid,
	});

	// Embed in vector store (best-effort)
	try {
		await postJSON('/knowledge/embed', {
			id: entry.id,
			content: entry.content,
			metadata: { type: 'document', title, filename: file.name },
		});
		await markAsEmbedded(entry.id);
		entry.is_embedded = true;
	} catch {
		// Embedding failed — entry saved but not embedded
	}

	return jsonOk(entry, 201);
};
