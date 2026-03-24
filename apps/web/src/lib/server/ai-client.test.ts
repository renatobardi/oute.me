import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * ai-client.ts makes TWO fetch calls per request:
 * 1. getAuthHeaders() → fetches GCP metadata server (fails in non-GCP → returns {})
 * 2. The actual API call (postJSON, getJSON, proxySSE, postFile)
 *
 * We must mock both. The first always rejects (non-GCP), the second is configurable.
 */
const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

/**
 * Helper: first call to fetch (metadata server) rejects, second returns the given response.
 */
function mockFetchWithAuth(response: Record<string, unknown>) {
	// 1st call: metadata server → reject (non-GCP)
	mockFetch.mockRejectedValueOnce(new Error('not on GCP'));
	// 2nd call: actual API request → resolve with response
	mockFetch.mockResolvedValueOnce(response);
}

describe('ai-client.ts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset the cached token so each test starts fresh
		vi.resetModules();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('postJSON', () => {
		it('sends correct headers and body', async () => {
			mockFetchWithAuth({ ok: true, json: () => Promise.resolve({ result: 'ok' }) });

			const { postJSON } = await import('./ai-client');
			const body = { test: 'data' };
			await postJSON('/api/test', body);

			// The second call (index 1) is the actual API call
			const actualCall = mockFetch.mock.calls[1];
			expect(actualCall[1].method).toBe('POST');
			expect(actualCall[1].headers['Content-Type']).toBe('application/json');
			expect(JSON.parse(actualCall[1].body)).toEqual(body);
		});

		it('throws on non-ok response with detail', async () => {
			mockFetchWithAuth({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid request' }),
			});

			const { postJSON } = await import('./ai-client');
			await expect(postJSON('/api/test', {})).rejects.toThrow('Invalid request');
		});

		it('throws on non-ok response without detail', async () => {
			mockFetchWithAuth({
				ok: false,
				status: 500,
				json: () => Promise.reject(new Error('Parse error')),
			});

			const { postJSON } = await import('./ai-client');
			await expect(postJSON('/api/test', {})).rejects.toThrow('AI service error 500');
		});

		it('returns parsed JSON response', async () => {
			const expectedData = { id: '123', status: 'processing' };
			mockFetchWithAuth({
				ok: true,
				json: () => Promise.resolve(expectedData),
			});

			const { postJSON } = await import('./ai-client');
			const result = await postJSON('/api/test', {});

			expect(result).toEqual(expectedData);
		});

		it('constructs correct URL from path', async () => {
			mockFetchWithAuth({ ok: true, json: () => Promise.resolve({}) });

			const { postJSON } = await import('./ai-client');
			await postJSON('/api/estimate', {});

			const callUrl = mockFetch.mock.calls[1][0];
			expect(callUrl).toBe('http://localhost:8000/api/estimate');
		});
	});

	describe('getJSON', () => {
		it('sends request and returns parsed JSON', async () => {
			const expectedData = { data: 'test' };
			mockFetchWithAuth({ ok: true, json: () => Promise.resolve(expectedData) });

			const { getJSON } = await import('./ai-client');
			const result = await getJSON('/api/status');

			expect(result).toEqual(expectedData);
			expect(mockFetch.mock.calls[1][0]).toBe('http://localhost:8000/api/status');
		});

		it('throws on non-ok response', async () => {
			mockFetchWithAuth({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ error: 'Not found' }),
			});

			const { getJSON } = await import('./ai-client');
			await expect(getJSON('/api/missing')).rejects.toThrow('AI service error 404');
		});
	});

	describe('proxySSE', () => {
		it('sends POST request with JSON content-type', async () => {
			mockFetchWithAuth({ ok: true, status: 200 });

			const { proxySSE } = await import('./ai-client');
			await proxySSE('/sse/chat', { message: 'hello' });

			const actualCall = mockFetch.mock.calls[1];
			expect(actualCall[1].method).toBe('POST');
			expect(actualCall[1].headers['Content-Type']).toBe('application/json');
		});

		it('throws on non-ok response', async () => {
			mockFetchWithAuth({ ok: false, status: 500 });

			const { proxySSE } = await import('./ai-client');
			await expect(proxySSE('/sse/chat', {})).rejects.toThrow('AI service error');
		});

		it('returns response object on success', async () => {
			mockFetchWithAuth({ ok: true, status: 200, body: 'stream' });

			const { proxySSE } = await import('./ai-client');
			const result = await proxySSE('/sse/interview', {});

			expect(result.ok).toBe(true);
		});
	});

	describe('warmUpAiService', () => {
		it("doesn't throw on failure", async () => {
			mockFetch.mockRejectedValue(new Error('Timeout'));

			const { warmUpAiService } = await import('./ai-client');
			expect(() => warmUpAiService()).not.toThrow();
		});

		it('returns undefined immediately (fire-and-forget)', async () => {
			mockFetch.mockResolvedValue({ ok: true });

			const { warmUpAiService } = await import('./ai-client');
			const result = warmUpAiService();

			expect(result).toBeUndefined();
		});
	});

	describe('postFile', () => {
		it('sends FormData with correct method', async () => {
			mockFetchWithAuth({
				ok: true,
				json: () => Promise.resolve({ extracted_text: 'Sample', status: 'done' }),
			});

			const { postFile } = await import('./ai-client');
			const file = new Blob(['content'], { type: 'application/pdf' });
			await postFile('/extract', file, 'document.pdf');

			const actualCall = mockFetch.mock.calls[1];
			expect(actualCall[1].method).toBe('POST');
			expect(actualCall[1].body).toBeInstanceOf(FormData);
		});

		it('returns extracted text and status', async () => {
			const expectedResult = { extracted_text: 'Key findings...', status: 'processed' };
			mockFetchWithAuth({
				ok: true,
				json: () => Promise.resolve(expectedResult),
			});

			const { postFile } = await import('./ai-client');
			const file = new Blob(['pdf content'], { type: 'application/pdf' });
			const result = await postFile('/extract', file, 'file.pdf');

			expect(result.extracted_text).toBe('Key findings...');
			expect(result.status).toBe('processed');
		});

		it('throws on non-ok response', async () => {
			mockFetchWithAuth({ ok: false, status: 400 });

			const { postFile } = await import('./ai-client');
			const file = new Blob(['content']);
			await expect(postFile('/extract', file, 'bad.pdf')).rejects.toThrow(
				'AI service error'
			);
		});

		it('constructs correct URL', async () => {
			mockFetchWithAuth({
				ok: true,
				json: () => Promise.resolve({ extracted_text: '', status: 'done' }),
			});

			const { postFile } = await import('./ai-client');
			const file = new Blob(['content']);
			await postFile('/extract', file, 'file.pdf');

			const callUrl = mockFetch.mock.calls[1][0];
			expect(callUrl).toBe('http://localhost:8000/extract');
		});
	});
});
