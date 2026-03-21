import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/api-utils';
import { getOrCreateUser } from '$lib/server/users';
import { deleteDocument } from '$lib/server/interviews';
import { deleteFile } from '$lib/server/storage';
import { jsonOk, jsonError } from '$lib/server/api-utils';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const auth = requireAuth(locals);
	const user = await getOrCreateUser(auth.uid, auth.email, auth.name);

	const deleted = await deleteDocument(params.docId, params.id, user.id);
	if (!deleted) {
		return jsonError(404, 'Document not found');
	}

	// Remove from storage (best-effort)
	await deleteFile(deleted.storage_path).catch((err) => {
		console.error(`[DeleteDoc] Failed to remove file from storage (${deleted.storage_path}):`, err);
	});

	return jsonOk({ deleted: true });
};
