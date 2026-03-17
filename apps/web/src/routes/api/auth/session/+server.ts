import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminAuth } from '$lib/server/firebase-admin';
import { getOrCreateUser, setUserEmailVerified } from '$lib/server/users';

const COOKIE_NAME = '__session';
const MAX_AGE = 60 * 60 * 24 * 5; // 5 days

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();
	const idToken = body?.idToken;

	if (!idToken) {
		return json({ error: 'Missing idToken' }, { status: 400 });
	}

	let decoded;
	try {
		decoded = await getAdminAuth().verifyIdToken(idToken);
		if (!decoded.uid) {
			return json({ error: 'Invalid token' }, { status: 401 });
		}
	} catch {
		return json({ error: 'Invalid token' }, { status: 401 });
	}

	const user = await getOrCreateUser(decoded.uid, decoded.email ?? '', decoded.name);

	if (decoded.email_verified && !user.email_verified) {
		await setUserEmailVerified(decoded.uid);
		user.email_verified = true;
	}

	cookies.set(COOKIE_NAME, idToken, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: MAX_AGE,
	});

	return json({
		status: 'ok',
		onboarding_complete: user.onboarding_complete,
		active: user.active,
	});
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete(COOKIE_NAME, { path: '/' });
	return json({ status: 'ok' });
};
