import { vi } from 'vitest';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Mock do Firebase Admin SDK para testes.
 *
 * Uso nos testes:
 *   vi.mock('$lib/server/firebase-admin', () => import('./__mocks__/firebase-admin'));
 */

interface MockAuthConfig {
	idTokenResult?: DecodedIdToken | null;
	sessionCookieResult?: DecodedIdToken | null;
	idTokenError?: Error | null;
	sessionCookieError?: Error | null;
	sessionCookieValue?: string | null;
}

let _config: MockAuthConfig = {};

/** Configura o comportamento dos métodos mockados. */
export function setMockAuthConfig(config: Partial<MockAuthConfig>): void {
	_config = { ..._config, ...config };
}

/** Reseta para o estado inicial: todos os métodos rejeitam. */
export function resetMockAuthConfig(): void {
	_config = {};
}

/** Alias para compatibilidade. */
export const resetMockAuth = resetMockAuthConfig;

export function getAdminAuth() {
	return {
		verifyIdToken: vi.fn(async (_token: string): Promise<DecodedIdToken> => {
			if (_config.idTokenError) throw _config.idTokenError;
			if (_config.idTokenResult) return _config.idTokenResult;
			throw new Error('auth/invalid-token');
		}),

		verifySessionCookie: vi.fn(
			async (_cookie: string, _checkRevoked: boolean): Promise<DecodedIdToken> => {
				if (_config.sessionCookieError) throw _config.sessionCookieError;
				if (_config.sessionCookieResult) return _config.sessionCookieResult;
				throw new Error('auth/invalid-session-cookie');
			}
		),

		createSessionCookie: vi.fn(
			async (_idToken: string, _options: { expiresIn: number }): Promise<string> => {
				if (_config.sessionCookieValue) return _config.sessionCookieValue;
				throw new Error('auth/invalid-token');
			}
		),
	};
}
