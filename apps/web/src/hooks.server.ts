import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { verifyAuthToken } from '$lib/server/auth';
import { rateLimit, securityHeaders } from '$lib/server/security';

const redirectDomain: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host') ?? '';
	if (host.startsWith('www.')) {
		const url = new URL(event.request.url);
		url.hostname = url.hostname.replace('www.', '');
		return Response.redirect(url.toString(), 301);
	}
	return resolve(event);
};

const authenticate: Handle = async ({ event, resolve }) => {
	event.locals.user = await verifyAuthToken(event);
	return resolve(event);
};

export const handle = sequence(redirectDomain, rateLimit, authenticate, securityHeaders);
