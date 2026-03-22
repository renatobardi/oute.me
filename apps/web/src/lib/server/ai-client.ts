import { env } from '$env/dynamic/private';
import { logger } from './logger';

function getBaseUrl(): string {
	return env.AI_SERVICE_URL || 'http://localhost:8000';
}

let cachedToken: { token: string; expires: number } | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50min (tokens valem 1h)

async function getAuthHeaders(): Promise<Record<string, string>> {
	const now = Date.now();
	if (cachedToken && now < cachedToken.expires) {
		return { Authorization: `Bearer ${cachedToken.token}` };
	}

	const baseUrl = getBaseUrl();
	try {
		const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${baseUrl}`;
		const res = await fetch(metadataUrl, {
			headers: { 'Metadata-Flavor': 'Google' },
		});
		if (res.ok) {
			const token = await res.text();
			cachedToken = { token, expires: now + TOKEN_TTL_MS };
			return { Authorization: `Bearer ${token}` };
		}
	} catch {
		// Not running on GCP (local dev) — no auth needed
	}
	return {};
}

export async function proxySSE(path: string, body: object): Promise<Response> {
	const url = `${getBaseUrl()}${path}`;
	const authHeaders = await getAuthHeaders();
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		logger.error({ path, status: response.status }, 'AI proxy SSE request failed');
		throw new Error(`AI service error: ${response.status}`);
	}

	return response;
}

async function throwAiError(response: Response): Promise<never> {
	let detail = '';
	try {
		const body = await response.json();
		detail = body?.detail || body?.message || body?.error || '';
	} catch {
		// ignore parse error
	}
	throw new Error(`AI service error ${response.status}${detail ? `: ${detail}` : ''}`);
}

export async function postJSON<T>(path: string, body: object): Promise<T> {
	const url = `${getBaseUrl()}${path}`;
	const authHeaders = await getAuthHeaders();
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		await throwAiError(response);
	}

	return response.json() as Promise<T>;
}

export async function getJSON<T>(path: string): Promise<T> {
	const url = `${getBaseUrl()}${path}`;
	const authHeaders = await getAuthHeaders();
	const response = await fetch(url, { headers: authHeaders });

	if (!response.ok) {
		await throwAiError(response);
	}

	return response.json() as Promise<T>;
}

/**
 * Fire-and-forget ping to wake up the AI service if it's scaled to zero.
 * Call without await at the start of page server loads that will need the AI service.
 */
export function warmUpAiService(): void {
	const url = `${getBaseUrl()}/health/services`;
	getAuthHeaders()
		.then((headers) => fetch(url, { headers, signal: AbortSignal.timeout(10_000) }))
		.catch(() => {
			// Intentionally silent — this is best-effort warm-up only
		});
}

export async function postFile(
	path: string,
	file: Blob,
	filename: string,
	timeoutMs = 25_000
): Promise<{ extracted_text: string; status: string }> {
	const url = `${getBaseUrl()}${path}`;
	const authHeaders = await getAuthHeaders();
	const formData = new FormData();
	formData.append('file', file, filename);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: authHeaders,
			body: formData,
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`AI service error: ${response.status}`);
		}

		return response.json();
	} finally {
		clearTimeout(timer);
	}
}
