import { env } from '$env/dynamic/private';

function getBaseUrl(): string {
	return env.AI_SERVICE_URL || 'http://localhost:8000';
}

async function getAuthHeaders(): Promise<Record<string, string>> {
	const baseUrl = getBaseUrl();
	// In Cloud Run, fetch an identity token for service-to-service auth
	// The metadata server is available automatically in GCP environments
	try {
		const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${baseUrl}`;
		const res = await fetch(metadataUrl, {
			headers: { 'Metadata-Flavor': 'Google' },
		});
		if (res.ok) {
			const token = await res.text();
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
		throw new Error(`AI service error: ${response.status}`);
	}

	return response;
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
		throw new Error(`AI service error: ${response.status}`);
	}

	return response.json() as Promise<T>;
}

export async function getJSON<T>(path: string): Promise<T> {
	const url = `${getBaseUrl()}${path}`;
	const authHeaders = await getAuthHeaders();
	const response = await fetch(url, { headers: authHeaders });

	if (!response.ok) {
		throw new Error(`AI service error: ${response.status}`);
	}

	return response.json() as Promise<T>;
}

export async function postFile(
	path: string,
	file: Blob,
	filename: string
): Promise<{ extracted_text: string; status: string }> {
	const url = `${getBaseUrl()}${path}`;
	const authHeaders = await getAuthHeaders();
	const formData = new FormData();
	formData.append('file', file, filename);

	const response = await fetch(url, {
		method: 'POST',
		headers: authHeaders,
		body: formData,
	});

	if (!response.ok) {
		throw new Error(`AI service error: ${response.status}`);
	}

	return response.json();
}
