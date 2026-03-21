import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api-utils';
import sql from '$lib/server/db';
import { downloadFile } from '$lib/server/storage';

export const GET: RequestHandler = async ({ locals, params }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) throw error(403, 'Admin access required');

	const rows = await sql<{ filename: string; mime_type: string; storage_path: string }[]>`
		SELECT filename, mime_type, storage_path
		FROM public.documents
		WHERE id = ${params.id}
		LIMIT 1
	`;

	const doc = rows[0];
	if (!doc) throw error(404, 'Document not found');

	let fileBytes: Buffer;
	try {
		fileBytes = await downloadFile(doc.storage_path);
	} catch {
		throw error(404, 'File not found on storage');
	}

	return new Response(new Uint8Array(fileBytes), {
		headers: {
			'Content-Type': doc.mime_type,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.filename)}"`,
			'Content-Length': String(fileBytes.length),
		},
	});
};
