import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminAuth } from '$lib/server/firebase-admin';

const COOKIE_NAME = '__session';
const MAX_AGE = 60 * 60 * 24 * 5; // 5 days

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();
	const idToken = body?.idToken;

	if (!idToken) {
		return json({ error: 'Missing idToken' }, { status: 400 });
	}

	try {
		const decoded = await getAdminAuth().verifyIdToken(idToken);
		if (!decoded.uid) {
			return json({ error: 'Invalid token' }, { status: 401 });
		}

		cookies.set(COOKIE_NAME, idToken, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: MAX_AGE,
		});

		return json({ status: 'ok' });
	} catch {
		return json({ error: 'Invalid token' }, { status: 401 });
	}
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete(COOKIE_NAME, { path: '/' });
	return json({ status: 'ok' });
};
