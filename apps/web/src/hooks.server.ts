import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { verifyAuthToken } from '$lib/server/auth';
import { rateLimit, securityHeaders } from '$lib/server/security';

const redirectOutePro: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host') ?? '';
	if (host.includes('oute.pro')) {
		const url = new URL(event.request.url);
		url.hostname = 'oute.me';
		return Response.redirect(url.toString(), 301);
	}
	return resolve(event);
};

const authenticate: Handle = async ({ event, resolve }) => {
	event.locals.user = await verifyAuthToken(event);
	return resolve(event);
};

export const handle = sequence(redirectOutePro, rateLimit, authenticate, securityHeaders);
