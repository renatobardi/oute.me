import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { verifyAuthToken } from '$lib/server/auth';
import { rateLimit, securityHeaders } from '$lib/server/security';
import { getOrCreateUser, setUserEmailVerified } from '$lib/server/users';

const cacheControl: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const { pathname } = event.url;

	// Assets imutáveis com hash gerado pelo Vite — cache de 1 ano
	if (pathname.startsWith('/_app/immutable/')) {
		response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		return response;
	}

	// Assets estáticos sem hash — cache de 1 hora
	if (/\.(ico|png|svg|woff2|webp|jpg|jpeg|gif)$/.test(pathname)) {
		response.headers.set('Cache-Control', 'public, max-age=3600');
		return response;
	}

	// API e SSE: nunca cachear
	if (pathname.startsWith('/api/')) {
		response.headers.set('Cache-Control', 'no-store');
		return response;
	}

	// Páginas públicas — cache curto (60s) para reduzir cold starts
	if (pathname === '/' || pathname === '/login') {
		response.headers.set('Cache-Control', 'public, max-age=60');
		return response;
	}

	// Páginas autenticadas (SSR com dados do usuário) — nunca cachear
	response.headers.set('Cache-Control', 'private, no-store');
	return response;
};

const redirectDomain: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host') ?? '';

	// oute.me (com ou sem www) → oute.pro
	if (host === 'oute.me' || host === 'www.oute.me') {
		const url = new URL(event.url.pathname + event.url.search, 'https://oute.pro');
		return Response.redirect(url.toString(), 301);
	}

	// www.oute.pro → oute.pro
	if (host.startsWith('www.')) {
		const bare = host.replace(/^www\./, '');
		const url = new URL(event.url.pathname + event.url.search, `https://${bare}`);
		return Response.redirect(url.toString(), 301);
	}

	return resolve(event);
};

const authenticate: Handle = async ({ event, resolve }) => {
	event.locals.user = await verifyAuthToken(event);
	return resolve(event);
};

const gateUser: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Rotas públicas — sem necessidade de DB lookup
	if (pathname === '/' || pathname === '/login') return resolve(event);

	// Endpoints de auth — gerenciam sua própria autenticação
	if (pathname.startsWith('/api/auth/')) return resolve(event);

	// Não autenticado
	if (!event.locals.user) {
		return Response.redirect(new URL('/login', event.url).toString(), 302);
	}

	// Busca ou cria usuário no DB
	const dbUser = await getOrCreateUser(
		event.locals.user.uid,
		event.locals.user.email,
		event.locals.user.name
	);

	// Espelha email_verified do token no DB
	if (event.locals.user.emailVerified && !dbUser.email_verified) {
		await setUserEmailVerified(event.locals.user.uid);
		dbUser.email_verified = true;
	}

	event.locals.dbUser = dbUser;

	// Rotas de admin
	if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
		if (!dbUser.is_admin) {
			return Response.redirect(new URL('/interviews', event.url).toString(), 302);
		}
		return resolve(event);
	}

	// Permite /onboarding e /api/users/me sempre que autenticado
	if (pathname === '/onboarding' || pathname.startsWith('/api/users/me')) {
		return resolve(event);
	}

	// Permite /pending sempre que autenticado
	if (pathname === '/pending') return resolve(event);

	// Gate 1: onboarding não completo
	if (!dbUser.onboarding_complete) {
		return Response.redirect(new URL('/onboarding', event.url).toString(), 302);
	}

	// Gate 2: e-mail não verificado
	if (!dbUser.email_verified) {
		return Response.redirect(new URL('/pending', event.url).toString(), 302);
	}

	// Gate 3: não ativado pelo admin
	if (!dbUser.active) {
		return Response.redirect(new URL('/pending', event.url).toString(), 302);
	}

	return resolve(event);
};

export const handle = sequence(redirectDomain, rateLimit, authenticate, gateUser, cacheControl, securityHeaders);
