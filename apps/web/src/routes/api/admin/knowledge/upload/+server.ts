import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk, jsonError } from '$lib/server/api-utils';
import { createKnowledgeEntry, markAsEmbedded } from '$lib/server/admin-knowledge';
import { postFile, postJSON } from '$lib/server/ai-client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch (err) {
		console.error('[admin/knowledge/upload] formData parse error:', err);
		return jsonError(400, 'Falha ao processar upload. Verifique o tamanho do arquivo.');
	}

	const file = formData.get('file') as File | null;
	const title = formData.get('title') as string | null;

	if (!file || !title) {
		return jsonError(400, 'file and title are required');
	}

	if (file.size > MAX_FILE_SIZE) {
		return jsonError(413, `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 50 MB.`);
	}

	// Extract text from document via FastAPI (10 min timeout for large PDFs)
	let extracted: { extracted_text: string; status: string };
	try {
		extracted = await postFile('/chat/process-document', file, file.name, 600_000);
	} catch (err) {
		console.error('[admin/knowledge/upload] AI extraction error:', err);
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
