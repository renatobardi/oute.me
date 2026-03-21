import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api-utils';
import { getOrCreateUser } from '$lib/server/users';
import { getInterview, addDocument, updateDocumentStatus } from '$lib/server/interviews';
import { postFile } from '$lib/server/ai-client';
import { jsonOk, jsonError } from '$lib/server/api-utils';
import { uploadFile, storageBackend } from '$lib/server/storage';

const ALLOWED_TYPES = new Set([
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-excel',
	'text/csv',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.ms-powerpoint',
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	const interview = await getInterview(params.id, user.id);
	if (!interview) {
		throw error(404, 'Interview not found');
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		return jsonError(400, 'File is required');
	}

	if (!ALLOWED_TYPES.has(file.type)) {
		return jsonError(400, `File type not supported: ${file.type}`);
	}

	if (file.size > MAX_FILE_SIZE) {
		return jsonError(400, 'File too large (max 10MB)');
	}

	// 1. Read file bytes
	let buffer: Buffer;
	try {
		buffer = Buffer.from(await file.arrayBuffer());
	} catch (err) {
		console.error(`[Upload] Failed to read file bytes for interview ${params.id}:`, err);
		return jsonError(400, 'Failed to read file');
	}

	// 2. Upload to storage (GCS in prod, local in dev)
	const storagePath = `interviews/${params.id}/${Date.now()}_${file.name}`;
	try {
		await uploadFile(storagePath, buffer, file.type);
	} catch (err) {
		console.error(
			`[Upload] Failed to save file to ${storageBackend()} for interview ${params.id}:`,
			err
		);
		return jsonError(500, 'Failed to save file');
	}

	// 3. Create DB record
	let doc: { id: string };
	try {
		doc = await addDocument(params.id, file.name, file.type, storagePath);
	} catch (err) {
		console.error(`[Upload] Failed to create document record for interview ${params.id}:`, err);
		return jsonError(500, 'Failed to register document');
	}

	// 4. Send to AI service for text extraction (best-effort — does not fail the upload)
	let processedStatus: 'completed' | 'failed' | 'pending' = 'pending';
	let extractedText: string | undefined;

	try {
		const result = await postFile(
			'/chat/process-document',
			new File([new Uint8Array(buffer)], file.name, { type: file.type }),
			file.name
		);
		processedStatus = result.status === 'completed' ? 'completed' : 'failed';
		extractedText = result.extracted_text;
	} catch (err) {
		console.error(
			`[Upload] AI processing failed for document ${doc.id} (interview ${params.id}):`,
			err
		);
		processedStatus = 'failed';
	}

	await updateDocumentStatus(doc.id, processedStatus, extractedText).catch((err) => {
		console.error(`[Upload] Failed to update document status for ${doc.id}:`, err);
	});

	return jsonOk({
		document: {
			id: doc.id,
			filename: file.name,
			status: processedStatus,
		},
	});
};
