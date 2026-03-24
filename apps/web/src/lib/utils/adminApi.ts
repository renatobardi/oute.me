/**
 * adminApi.ts
 * Funções tipadas para chamadas ao BFF do painel admin.
 * Centraliza os paths e evita strings hardcoded nos componentes.
 */

import type { InterviewMessage } from '$lib/types/interview';

type FetchHeaders = Record<string, string>;

function authHeaders(token: string | null | undefined): FetchHeaders {
	return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function downloadAdminDocument(
	docId: string,
	token: string | null
): Promise<Response> {
	return fetch(`/api/admin/cockpit/documents/${docId}/download`, {
		headers: authHeaders(token),
	});
}

export async function loadInterviewMessages(
	interviewId: string,
	offset: number,
	limit: number,
	token: string | null
): Promise<{ messages: InterviewMessage[] }> {
	const res = await fetch(
		`/api/admin/cockpit/interviews/${interviewId}/messages?offset=${offset}&limit=${limit}`,
		{ headers: authHeaders(token) }
	);
	if (!res.ok) return { messages: [] };
	return res.json();
}

export async function fetchAgentOutputApi(
	interviewId: string,
	agentKey: string,
	token: string | null
): Promise<Record<string, unknown> | null> {
	const res = await fetch(
		`/api/admin/cockpit/interviews/${interviewId}/pipeline?agent=${encodeURIComponent(agentKey)}`,
		{ headers: authHeaders(token) }
	);
	if (!res.ok) return null;
	return res.json();
}

export async function triggerPipelineRun(
	interviewId: string,
	params: { llm_model: string; from_agent?: string },
	token: string | null
): Promise<{ ok: boolean; error?: string }> {
	const body: Record<string, string> = { llm_model: params.llm_model };
	if (params.from_agent) body.from_agent = params.from_agent;

	const res = await fetch(`/api/admin/cockpit/interviews/${interviewId}/pipeline`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...authHeaders(token),
		},
		body: JSON.stringify(body),
	});

	if (res.ok) return { ok: true };
	const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
	return { ok: false, error: err.error ?? res.statusText };
}
