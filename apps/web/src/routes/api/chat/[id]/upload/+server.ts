import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api-utils';
import { getOrCreateUser } from '$lib/server/users';
import { getInterview, addDocument, updateDocumentStatus } from '$lib/server/interviews';
import { postFile } from '$lib/server/ai-client';
import { jsonOk, jsonError } from '$lib/server/api-utils';

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

	const storagePath = `interviews/${params.id}/${Date.now()}_${file.name}`;

	let doc: { id: string } | undefined;
	try {
		doc = await addDocument(params.id, file.name, file.type, storagePath);
		const result = await postFile('/chat/process-document', file, file.name);

		await updateDocumentStatus(
			doc.id,
			result.status === 'completed' ? 'completed' : 'failed',
			result.extracted_text
		);

		return jsonOk({
			document: {
				id: doc.id,
				filename: file.name,
				status: result.status,
			},
		});
	} catch (err) {
		console.error(`[Upload] Failed for interview ${params.id}:`, err);
		if (doc?.id) {
			await updateDocumentStatus(doc.id, 'failed').catch(() => {});
		}
		return jsonError(502, 'Failed to process document');
	}
};
