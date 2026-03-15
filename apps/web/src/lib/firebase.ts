import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_PROJECT_ID,
} from '$env/static/public';

function getFirebaseClient(): FirebaseApp {
	const existing = getApps();
	if (existing.length > 0) {
		return existing[0];
	}

	return initializeApp({
		apiKey: PUBLIC_FIREBASE_API_KEY,
		authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
		projectId: PUBLIC_FIREBASE_PROJECT_ID,
	});
}

const app = getFirebaseClient();
export const auth: Auth = getAuth(app);
