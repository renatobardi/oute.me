import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminAuth } from '$lib/server/firebase-admin';
import { getOrCreateUser, setUserEmailVerified } from '$lib/server/users';

const COOKIE_NAME = '__session';
const MAX_AGE = 60 * 60 * 24 * 5; // 5 dias

export const POST: RequestHandler = async ({ request, cookies }) => {
	// Parseia o body com proteção contra JSON inválido ou body ausente
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const idToken = body?.idToken;

	if (!idToken || typeof idToken !== 'string') {
		return json({ error: 'Missing idToken' }, { status: 400 });
	}

	// Verifica o ID token antes de criar a session cookie
	let decoded;
	try {
		decoded = await getAdminAuth().verifyIdToken(idToken);
		if (!decoded.uid) {
			return json({ error: 'Invalid token' }, { status: 401 });
		}
	} catch {
		return json({ error: 'Invalid token' }, { status: 401 });
	}

	// Troca o ID token (expira em 1h) por uma session cookie com validade real de 5 dias
	let sessionCookie: string;
	try {
		sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
			expiresIn: MAX_AGE * 1000,
		});
	} catch {
		return json({ error: 'Failed to create session' }, { status: 500 });
	}

	const user = await getOrCreateUser(decoded.uid, decoded.email ?? '', decoded.name);

	if (decoded.email_verified && !user.email_verified) {
		await setUserEmailVerified(decoded.uid);
		user.email_verified = true;
	}

	cookies.set(COOKIE_NAME, sessionCookie, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		maxAge: MAX_AGE,
	});

	return json({
		status: 'ok',
		onboarding_complete: user.onboarding_complete,
		active: user.active,
	});
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	const sessionCookie = cookies.get(COOKIE_NAME);

	if (sessionCookie) {
		try {
			const decoded = await getAdminAuth().verifySessionCookie(sessionCookie);
			// Revoga todos os refresh tokens do usuário — invalida a sessão server-side
			await getAdminAuth().revokeRefreshTokens(decoded.sub);
		} catch {
			// Ignora erros (cookie expirado ou inválido) — deleta de qualquer forma
		}
	}

	cookies.delete(COOKIE_NAME, { path: '/' });
	return json({ status: 'ok' });
};
