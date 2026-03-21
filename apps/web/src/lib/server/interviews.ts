import sql from './db';
import { createDefaultState } from '$lib/types/interview';
import type { Interview, InterviewMessage, InterviewDocument, InterviewState } from '$lib/types/interview';

const REQUIRED_DOMAINS = ['scope', 'timeline', 'budget', 'integrations', 'tech_stack'] as const;

function validateInterviewState(state: InterviewState): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!state.domains || typeof state.domains !== 'object') {
		errors.push('Missing or invalid domains object');
		return { valid: false, errors };
	}

	for (const domain of REQUIRED_DOMAINS) {
		const d = state.domains[domain];
		if (!d) {
			errors.push(`Missing required domain: ${domain}`);
			continue;
		}
		if (typeof d.answered !== 'number') {
			errors.push(`Domain ${domain}: missing or invalid 'answered' (number)`);
		}
		if (typeof d.total !== 'number') {
			errors.push(`Domain ${domain}: missing or invalid 'total' (number)`);
		}
		if (typeof d.vital_answered !== 'boolean') {
			errors.push(`Domain ${domain}: missing or invalid 'vital_answered' (boolean)`);
		}
	}

	return { valid: errors.length === 0, errors };
}

export async function createInterview(userId: string, title?: string): Promise<Interview> {
	const defaultState = createDefaultState();
	const [row] = await sql<Interview[]>`
		INSERT INTO public.interviews (user_id, title, state)
		VALUES (${userId}, ${title ?? null}, ${sql.json(JSON.parse(JSON.stringify(defaultState)))})
		RETURNING *
	`;
	return row;
}

export async function getInterview(interviewId: string, userId: string): Promise<Interview | null> {
	const [row] = await sql<Interview[]>`
		SELECT * FROM public.interviews
		WHERE id = ${interviewId} AND user_id = ${userId}
	`;
	return row ?? null;
}

export async function getInterviewsByUser(userId: string): Promise<Interview[]> {
	return sql<Interview[]>`
		SELECT * FROM public.interviews
		WHERE user_id = ${userId}
		ORDER BY updated_at DESC
	`;
}

export async function updateInterviewState(
	interviewId: string,
	state: InterviewState,
	maturity: number
): Promise<void> {
	const validation = validateInterviewState(state);
	if (!validation.valid) {
		throw new Error(`Invalid interview state: ${validation.errors.join('; ')}`);
	}

	await sql`
		UPDATE public.interviews
		SET state = ${sql.json(JSON.parse(JSON.stringify(state)))}, maturity = ${maturity}
		WHERE id = ${interviewId}
	`;
}

export async function updateInterviewTitle(
	interviewId: string,
	title: string
): Promise<void> {
	await sql`
		UPDATE public.interviews
		SET title = ${title}
		WHERE id = ${interviewId}
	`;
}

export async function updateInterviewStatus(
	interviewId: string,
	status: string
): Promise<void> {
	await sql`
		UPDATE public.interviews
		SET status = ${status}
		WHERE id = ${interviewId}
	`;
}

export async function addMessage(
	interviewId: string,
	role: string,
	content: string,
	tokensUsed: number = 0
): Promise<InterviewMessage> {
	const [row] = await sql<InterviewMessage[]>`
		INSERT INTO public.interview_messages (interview_id, role, content, tokens_used)
		VALUES (${interviewId}, ${role}, ${content}, ${tokensUsed})
		RETURNING *
	`;
	return row;
}

export async function getMessages(
	interviewId: string,
	limit: number = 50
): Promise<InterviewMessage[]> {
	return sql<InterviewMessage[]>`
		SELECT * FROM public.interview_messages
		WHERE interview_id = ${interviewId}
		ORDER BY created_at ASC
		LIMIT ${limit}
	`;
}

export async function getRecentMessages(
	interviewId: string,
	limit: number = 20
): Promise<InterviewMessage[]> {
	const rows = await sql<InterviewMessage[]>`
		SELECT * FROM (
			SELECT * FROM public.interview_messages
			WHERE interview_id = ${interviewId}
			ORDER BY created_at DESC
			LIMIT ${limit}
		) sub
		ORDER BY created_at ASC
	`;
	return rows;
}

export async function checkDocumentDuplicate(
	interviewId: string,
	filename: string,
	fileHash: string
): Promise<{ reason: 'filename' | 'content' } | null> {
	const [byName] = await sql<{ id: string }[]>`
		SELECT id FROM public.documents
		WHERE interview_id = ${interviewId} AND filename = ${filename}
		LIMIT 1
	`;
	if (byName) return { reason: 'filename' };

	const [byHash] = await sql<{ id: string }[]>`
		SELECT id FROM public.documents
		WHERE interview_id = ${interviewId} AND file_hash = ${fileHash}
		LIMIT 1
	`;
	if (byHash) return { reason: 'content' };

	return null;
}

export async function addDocument(
	interviewId: string,
	filename: string,
	mimeType: string,
	storagePath: string,
	fileHash: string
): Promise<InterviewDocument> {
	const [row] = await sql<InterviewDocument[]>`
		INSERT INTO public.documents (interview_id, filename, mime_type, storage_path, file_hash)
		VALUES (${interviewId}, ${filename}, ${mimeType}, ${storagePath}, ${fileHash})
		RETURNING *
	`;
	return row;
}

export async function updateDocumentStatus(
	docId: string,
	status: string,
	extractedText?: string
): Promise<void> {
	await sql`
		UPDATE public.documents
		SET status = ${status}, extracted_text = ${extractedText ?? null}
		WHERE id = ${docId}
	`;
}

export async function getDocuments(interviewId: string): Promise<InterviewDocument[]> {
	return sql<InterviewDocument[]>`
		SELECT * FROM public.documents
		WHERE interview_id = ${interviewId}
		ORDER BY created_at ASC
	`;
}

export async function deleteDocument(
	docId: string,
	interviewId: string,
	userId: string
): Promise<{ storage_path: string } | null> {
	const [row] = await sql<{ storage_path: string }[]>`
		DELETE FROM public.documents
		WHERE id = ${docId}
		  AND interview_id = ${interviewId}
		  AND interview_id IN (
		    SELECT id FROM public.interviews WHERE user_id = ${userId}
		  )
		RETURNING storage_path
	`;
	return row ?? null;
}
