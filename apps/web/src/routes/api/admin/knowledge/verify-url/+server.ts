import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const { url } = (await request.json()) as { url: string };
	if (!url) return jsonError(400, 'url is required');

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
		clearTimeout(timeout);
		return jsonOk({ ok: res.ok, status: res.status });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'unreachable';
		return jsonOk({ ok: false, status: 0, error: msg });
	}
};
