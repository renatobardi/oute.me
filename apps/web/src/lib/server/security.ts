import type { Handle } from '@sveltejs/kit';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
	return (
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		request.headers.get('x-real-ip') ||
		'unknown'
	);
}

export const rateLimit: Handle = async ({ event, resolve }) => {
	const ip = getClientIp(event.request);
	const now = Date.now();

	let entry = requestCounts.get(ip);
	if (!entry || now > entry.resetAt) {
		entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
		requestCounts.set(ip, entry);
	}

	entry.count++;

	if (entry.count > RATE_LIMIT_MAX) {
		return new Response(JSON.stringify({ error: 'Too many requests' }), {
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
			},
		});
	}

	return resolve(event);
};

export const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=()'
	);

	// Isola o contexto de navegação de outros origins (mitiga Spectre e XS-Leaks)
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

	// Content Security Policy
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			// Firebase Auth SDK requer gstatic e googleapis
			"script-src 'self' 'unsafe-inline' https://www.gstatic.com",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: https:",
			"connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com",
			"frame-src https://accounts.google.com",
			"frame-ancestors 'none'",
		].join('; ')
	);

	if (event.url.protocol === 'https:') {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains; preload'
		);
		// Anuncia suporte a HTTP/3 (QUIC) — GFE já serve h3, isso o explicita aos clientes
		response.headers.set('Alt-Svc', 'h3=":443"; ma=86400');
	}

	return response;
};

// Periodic cleanup of expired entries
setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of requestCounts) {
		if (now > entry.resetAt) {
			requestCounts.delete(ip);
		}
	}
}, RATE_LIMIT_WINDOW_MS);
