import type { RequestEvent } from '@sveltejs/kit';
import { getAdminAuth } from './firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthUser {
	uid: string;
	email: string;
	name?: string;
	emailVerified: boolean;
}

function toAuthUser(decoded: DecodedIdToken): AuthUser {
	return {
		uid: decoded.uid,
		email: decoded.email ?? '',
		name: decoded.name,
		emailVerified: decoded.email_verified ?? false,
	};
}

/**
 * Extrai e valida o token Firebase:
 * - Bearer token no header Authorization → verifyIdToken (chamadas de API client-side)
 * - Cookie __session → verifySessionCookie com checkRevoked (navegação server-side)
 */
export async function verifyAuthToken(event: RequestEvent): Promise<AuthUser | null> {
	const authorization = event.request.headers.get('authorization');

	if (authorization?.startsWith('Bearer ')) {
		const token = authorization.slice(7);
		try {
			const decoded = await getAdminAuth().verifyIdToken(token);
			return toAuthUser(decoded);
		} catch {
			return null;
		}
	}

	const sessionCookie = event.cookies.get('__session');
	if (!sessionCookie) return null;

	try {
		// checkRevoked: true — invalida sessões revogadas via logout server-side
		const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
		return toAuthUser(decoded);
	} catch {
		return null;
	}
}
