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
	const authorization = event.request.headers.get('authorization');
	if (!authorization?.startsWith('Bearer ')) {
		return null;
	}

	const token = authorization.slice(7);
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
