import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { proxySSEGet } from '$lib/server/ai-client';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

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
