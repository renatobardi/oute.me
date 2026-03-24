import { vi } from 'vitest';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Mock Firebase Admin SDK for testing
 * Provides configurable token verification
 */

interface MockAuthConfig {
	idTokenResult?: DecodedIdToken | null;
	sessionCookieResult?: DecodedIdToken | null;
	idTokenError?: Error | null;
	sessionCookieError?: Error | null;
}

let mockConfig: MockAuthConfig = {
	idTokenResult: null,
	sessionCookieResult: null,
	idTokenError: null,
	sessionCookieError: null,
};

export function setMockAuthConfig(config: Partial<MockAuthConfig>) {
	mockConfig = { ...mockConfig, ...config };
}

export function resetMockAuth() {
	mockConfig = {
		idTokenResult: null,
		sessionCookieResult: null,
		idTokenError: null,
		sessionCookieError: null,
	};
}

export function getAdminAuth() {
	return {
		verifyIdToken: vi.fn(async (_token: string) => {
			if (mockConfig.idTokenError) {
				throw mockConfig.idTokenError;
			}
			if (mockConfig.idTokenResult) {
				return mockConfig.idTokenResult;
			}
			throw new Error('Token verification failed');
		}),

		verifySessionCookie: vi.fn(async (_cookie: string, _checkRevoked: boolean) => {
			if (mockConfig.sessionCookieError) {
				throw mockConfig.sessionCookieError;
			}
			if (mockConfig.sessionCookieResult) {
				return mockConfig.sessionCookieResult;
			}
			throw new Error('Session cookie verification failed');
		}),
	};
}
