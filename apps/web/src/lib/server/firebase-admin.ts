import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { env } from '$env/dynamic/private';

function getFirebaseAdmin(): App {
	const existing = getApps();
	if (existing.length > 0) {
		return existing[0];
	}

	const projectId = env.FIREBASE_PROJECT_ID;
	const clientEmail = env.FIREBASE_CLIENT_EMAIL;
	const privateKey = env.FIREBASE_PRIVATE_KEY;

	if (!projectId || !clientEmail || !privateKey) {
		throw new Error('Missing Firebase Admin environment variables');
	}

	return initializeApp({
		credential: cert({
			projectId,
			clientEmail,
			privateKey: privateKey.replace(/\\n/g, '\n'),
		}),
	});
}

let _adminAuth: Auth | null = null;

export function getAdminAuth(): Auth {
	if (!_adminAuth) {
		const adminApp = getFirebaseAdmin();
		_adminAuth = getAuth(adminApp);
	}
	return _adminAuth;
}
