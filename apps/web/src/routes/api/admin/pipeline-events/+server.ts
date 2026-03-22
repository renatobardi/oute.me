import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/api-utils';
import { proxySSEGet } from '$lib/server/ai-client';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return json({ error: 'Admin access required' }, { status: 403 });

	try {
		const upstream = await proxySSEGet('/admin/pipeline-events');
		return new Response(upstream.body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	} catch {
		// Fallback: keepalive stream se AI service não responder (Redis não configurado em dev)
		const stream = new ReadableStream({
			start(controller) {
				const enc = new TextEncoder();
				controller.enqueue(enc.encode(': keepalive\n\n'));
				const timer = setInterval(() => {
					try {
						controller.enqueue(enc.encode(': keepalive\n\n'));
					} catch {
						clearInterval(timer);
					}
				}, 15_000);
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	}
};
