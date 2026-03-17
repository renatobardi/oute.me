import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

const PUBLIC_ROUTES = ['/', '/login', '/onboarding', '/pending'];

export const ssr = false;

export const load: LayoutLoad = async ({ url }) => {
	if (!browser) {
		return { user: null };
	}

	const { auth } = await import('$lib/firebase');
	const { onAuthStateChanged } = await import('firebase/auth');

	const user = await new Promise<{ uid: string; email: string | null; displayName: string | null } | null>(
		(resolve) => {
			const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
				unsubscribe();
				if (firebaseUser) {
					resolve({
						uid: firebaseUser.uid,
						email: firebaseUser.email,
						displayName: firebaseUser.displayName,
					});
				} else {
					resolve(null);
				}
			});
		}
	);

	if (!user && !PUBLIC_ROUTES.includes(url.pathname)) {
		redirect(302, '/login');
	}

	return { user };
};
