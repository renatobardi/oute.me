import { env } from '$env/dynamic/private';

function getBaseUrl(): string {
	return env.AI_SERVICE_URL || 'http://localhost:8000';
}

export async function proxySSE(path: string, body: object): Promise<Response> {
	const url = `${getBaseUrl()}${path}`;
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		throw new Error(`AI service error: ${response.status}`);
	}

	return response;
}

export async function postJSON<T>(path: string, body: object): Promise<T> {
	const url = `${getBaseUrl()}${path}`;
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		throw new Error(`AI service error: ${response.status}`);
	}

	return response.json() as Promise<T>;
}

export async function getJSON<T>(path: string): Promise<T> {
	const url = `${getBaseUrl()}${path}`;
	const response = await fetch(url);

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
	const formData = new FormData();
	formData.append('file', file, filename);

	const response = await fetch(url, {
		method: 'POST',
		body: formData,
	});

	if (!response.ok) {
		throw new Error(`AI service error: ${response.status}`);
	}

	return response.json();
}
