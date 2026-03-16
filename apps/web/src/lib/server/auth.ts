import type { RequestEvent } from '@sveltejs/kit';
import { getAdminAuth } from './firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthUser {
	uid: string;
	email: string;
	name?: string;
}

/**
 * Extrai e valida o token Firebase do header Authorization.
 * Retorna null se não autenticado ou token inválido.
 */
export async function verifyAuthToken(event: RequestEvent): Promise<AuthUser | null> {
	// Try Authorization header first (API calls)
	const authorization = event.request.headers.get('authorization');
	let token: string | undefined;

	if (authorization?.startsWith('Bearer ')) {
		token = authorization.slice(7);
	}

	// Fall back to session cookie (page navigation)
	if (!token) {
		token = event.cookies.get('__session') || undefined;
	}

	if (!token) {
		return null;
	}

	try {
		const decoded: DecodedIdToken = await getAdminAuth().verifyIdToken(token);
		return {
			uid: decoded.uid,
			email: decoded.email ?? '',
			name: decoded.name,
		};
	} catch {
		return null;
	}
}
