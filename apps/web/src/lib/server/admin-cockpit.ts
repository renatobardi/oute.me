import sql from './db';
import type { Interview, InterviewMessage, InterviewDocument } from '$lib/types/interview';
import type { Estimate, EstimateRun } from '$lib/types/estimate';
import type { Project } from '$lib/types/project';

export interface CockpitInterview {
	id: string;
	title: string | null;
	status: string;
	maturity: number;
	created_at: string;
	updated_at: string;
	user_name: string | null;
	user_email: string;
	estimate_id: string | null;
	estimate_status: string | null;
	project_id: string | null;
}

export interface KnowledgeVector {
	id: string;
	source_type: string;
	source_id: string;
	content: string;
	metadata: Record<string, unknown>;
	created_at: string;
}

export interface CockpitDetail {
	interview: Interview;
	user_name: string | null;
	user_email: string;
	messages: InterviewMessage[];
	messageTotal: number;
	documents: InterviewDocument[];
	estimate: Estimate | null;
	estimateRuns: EstimateRun[];
	knowledgeVectors: KnowledgeVector[];
	project: Project | null;
}

export async function getAllInterviewsForAdmin(): Promise<CockpitInterview[]> {
	return sql<CockpitInterview[]>`
		SELECT
			i.id,
			i.title,
			i.status,
			i.maturity,
			i.created_at,
			i.updated_at,
			u.display_name AS user_name,
			u.email AS user_email,
			e.id AS estimate_id,
			e.status AS estimate_status,
			p.id AS project_id
		FROM public.interviews i
		JOIN public.users u ON u.id = i.user_id
		LEFT JOIN LATERAL (
			SELECT id, status FROM public.estimates
			WHERE interview_id = i.id
			ORDER BY created_at DESC LIMIT 1
		) e ON true
		LEFT JOIN LATERAL (
			SELECT id FROM public.projects
			WHERE estimate_id = e.id
			LIMIT 1
		) p ON true
		ORDER BY i.updated_at DESC
	`;
}

export async function getCockpitInterviewDetail(interviewId: string): Promise<CockpitDetail | null> {
	const [interviewRows, messageRows, messageCountRows, documentRows, estimateRows, vectorRows, estimateRunRows] =
		await Promise.all([
			sql<(Interview & { user_name: string | null; user_email: string })[]>`
				SELECT i.*, u.display_name AS user_name, u.email AS user_email
				FROM public.interviews i
				JOIN public.users u ON u.id = i.user_id
				WHERE i.id = ${interviewId}
			`,
			sql<InterviewMessage[]>`
				SELECT * FROM public.interview_messages
				WHERE interview_id = ${interviewId}
				ORDER BY created_at DESC
				LIMIT 20
			`,
			sql<{ count: string }[]>`
				SELECT count(*)::text AS count FROM public.interview_messages
				WHERE interview_id = ${interviewId}
			`,
			sql<InterviewDocument[]>`
				SELECT * FROM public.documents
				WHERE interview_id = ${interviewId}
				ORDER BY created_at ASC
			`,
			sql<Estimate[]>`
				SELECT * FROM public.estimates
				WHERE interview_id = ${interviewId}
				ORDER BY created_at DESC
				LIMIT 1
			`,
			sql<KnowledgeVector[]>`
				SELECT id, source_type, source_id, content, metadata, created_at
				FROM ai.knowledge_vectors
				WHERE source_id = ${interviewId}::uuid
				ORDER BY created_at ASC
			`,
			sql<EstimateRun[]>`
				SELECT er.* FROM public.estimate_runs er
				JOIN public.estimates e ON e.id = er.estimate_id
				WHERE e.interview_id = ${interviewId}
				ORDER BY er.created_at DESC
				LIMIT 10
			`,
		]);

	const interview = interviewRows[0];
	if (!interview) return null;

	const estimate = estimateRows[0] ?? null;

	let project: Project | null = null;
	if (estimate) {
		const projectRows = await sql<Project[]>`
			SELECT * FROM public.projects
			WHERE estimate_id = ${estimate.id}
			LIMIT 1
		`;
		project = projectRows[0] ?? null;
	}

	return {
		interview,
		user_name: interviewRows[0]?.user_name ?? null,
		user_email: interviewRows[0]?.user_email ?? '',
		messages: messageRows.reverse(),
		messageTotal: parseInt(messageCountRows[0]?.count ?? '0', 10),
		documents: documentRows,
		estimate,
		estimateRuns: estimateRunRows,
		knowledgeVectors: vectorRows,
		project,
	};
}

export async function getInterviewMessages(
	interviewId: string,
	offset: number,
	limit: number
): Promise<{ messages: InterviewMessage[]; total: number }> {
	const [messageRows, countRows] = await Promise.all([
		sql<InterviewMessage[]>`
			SELECT * FROM public.interview_messages
			WHERE interview_id = ${interviewId}
			ORDER BY created_at DESC
			LIMIT ${limit} OFFSET ${offset}
		`,
		sql<{ count: string }[]>`
			SELECT count(*)::text AS count FROM public.interview_messages
			WHERE interview_id = ${interviewId}
		`,
	]);

	return {
		messages: messageRows.reverse(),
		total: parseInt(countRows[0]?.count ?? '0', 10),
	};
}
