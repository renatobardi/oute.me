import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk, jsonError } from '$lib/server/api-utils';
import { createKnowledgeEntry, markAsEmbedded } from '$lib/server/admin-knowledge';
import { postFile, postJSON } from '$lib/server/ai-client';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const title = formData.get('title') as string | null;

	if (!file || !title) {
		return jsonError(400, 'file and title are required');
	}

	// Extract text from document via FastAPI
	let extracted: { extracted_text: string; status: string };
	try {
		extracted = await postFile('/chat/process-document', file, file.name, 300_000);
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Unknown error';
		return jsonError(502, `Falha ao processar documento: ${msg}`);
	}

	if (extracted.status !== 'completed') {
		return jsonError(422, 'Não foi possível extrair texto do documento. Verifique se o arquivo está legível.');
	}

	let entry;
	try {
		entry = await createKnowledgeEntry({
			type: 'document',
			title,
			content: extracted.extracted_text,
			filename: file.name,
			mime_type: file.type,
			created_by: locals.dbUser!.id,
		});
	} catch (err) {
		console.error('[admin/knowledge/upload] DB insert error:', err);
		const msg = err instanceof Error ? err.message : 'Unknown error';
		return jsonError(500, `Erro ao salvar documento: ${msg}`);
	}

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
