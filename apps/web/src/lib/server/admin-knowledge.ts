import sql from './db';

export interface AdminKnowledge {
	id: string;
	type: 'document' | 'url' | 'note';
	title: string;
	content: string;
	original_url: string | null;
	filename: string | null;
	mime_type: string | null;
	storage_path: string | null;
	is_embedded: boolean;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export async function getAllKnowledgeEntries(): Promise<AdminKnowledge[]> {
	return sql<AdminKnowledge[]>`
		SELECT * FROM public.admin_knowledge
		ORDER BY created_at DESC
	`;
}

export async function createKnowledgeEntry(data: {
	type: 'document' | 'url' | 'note';
	title: string;
	content: string;
	original_url?: string;
	filename?: string;
	mime_type?: string;
	storage_path?: string;
	created_by?: string;
}): Promise<AdminKnowledge> {
	const rows = await sql<AdminKnowledge[]>`
		INSERT INTO public.admin_knowledge (type, title, content, original_url, filename, mime_type, storage_path, created_by)
		VALUES (${data.type}, ${data.title}, ${data.content}, ${data.original_url ?? null}, ${data.filename ?? null}, ${data.mime_type ?? null}, ${data.storage_path ?? null}, ${data.created_by ?? null})
		RETURNING *
	`;
	return rows[0];
}

export async function updateKnowledgeEntry(
	id: string,
	data: { title: string; content: string; original_url: string | null }
): Promise<AdminKnowledge> {
	const rows = await sql<AdminKnowledge[]>`
		UPDATE public.admin_knowledge
		SET title = ${data.title}, content = ${data.content}, original_url = ${data.original_url}, updated_at = now()
		WHERE id = ${id}
		RETURNING *
	`;
	return rows[0];
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
	await sql`DELETE FROM public.admin_knowledge WHERE id = ${id}`;
}

export async function markAsEmbedded(id: string): Promise<void> {
	await sql`UPDATE public.admin_knowledge SET is_embedded = true WHERE id = ${id}`;
}
