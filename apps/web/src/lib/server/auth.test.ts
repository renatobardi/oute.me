import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyAuthToken } from './auth';
import { setMockAuthConfig, resetMockAuth } from './__mocks__/firebase-admin';
import { createMockRequestEvent, createMockUser } from '../../tests/fixtures';
import type { DecodedIdToken } from 'firebase-admin/auth';

vi.mock('./firebase-admin');

describe('auth.ts', () => {
	beforeEach(() => {
		resetMockAuth();
		vi.clearAllMocks();
	});

	describe('verifyAuthToken', () => {
		it('returns AuthUser when valid Bearer token is provided', async () => {
			const user = createMockUser({
				uid: 'user123',
				email: 'test@example.com',
				name: 'Test User',
				emailVerified: true,
			});

			const decodedToken: DecodedIdToken = {
				iss: 'https://securetoken.google.com/test-project',
				aud: 'test-project',
				auth_time: Math.floor(Date.now() / 1000),
				user_id: user.uid,
				sub: user.uid,
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				email: user.email,
				email_verified: user.emailVerified,
				name: user.name,
				uid: user.uid,
				firebase: { sign_in_provider: 'custom' },
			};

			setMockAuthConfig({ idTokenResult: decodedToken });

			const event = createMockRequestEvent();
			const result = await verifyAuthToken(event);

			expect(result).toEqual({
				uid: user.uid,
				email: user.email,
				name: user.name,
				emailVerified: user.emailVerified,
			});
		});

		it('returns null when no auth header and no cookie', async () => {
			const event = createMockRequestEvent({
				request: {
					headers: new Map(),
					method: 'GET',
					url: 'http://localhost:5173/api/test',
				},
				cookies: {
					get: () => undefined,
					set: () => {},
					delete: () => {},
					getAll: () => [],
					serialize: () => '',
				},
			});

			const result = await verifyAuthToken(event);

			expect(result).toBeNull();
		});

		it('returns null when Bearer token verification fails', async () => {
			setMockAuthConfig({ idTokenError: new Error('Invalid token') });

			const event = createMockRequestEvent();
			const result = await verifyAuthToken(event);

			expect(result).toBeNull();
		});

		it('returns AuthUser from session cookie when no Bearer token', async () => {
			const user = createMockUser({
				uid: 'user456',
				email: 'cookie@example.com',
				emailVerified: true,
			});

			const decodedToken: DecodedIdToken = {
				iss: 'https://securetoken.google.com/test-project',
				aud: 'test-project',
				auth_time: Math.floor(Date.now() / 1000),
				user_id: user.uid,
				sub: user.uid,
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				email: user.email,
				email_verified: user.emailVerified,
				uid: user.uid,
				firebase: { sign_in_provider: 'custom' },
			};

			setMockAuthConfig({ sessionCookieResult: decodedToken });

			const event = createMockRequestEvent({
				request: {
					headers: new Map(),
					method: 'GET',
					url: 'http://localhost:5173/api/test',
				},
				cookies: {
					get: (name: string) => {
						return name === '__session' ? 'session-cookie-value' : undefined;
					},
					set: () => {},
					delete: () => {},
					getAll: () => [],
					serialize: () => '',
				},
			});

			const result = await verifyAuthToken(event);

			expect(result).toEqual({
				uid: user.uid,
				email: user.email,
				name: undefined,
				emailVerified: user.emailVerified,
			});
		});

		it('returns null when session cookie verification fails', async () => {
			setMockAuthConfig({ sessionCookieError: new Error('Invalid session') });

			const event = createMockRequestEvent({
				request: {
					headers: new Map(),
					method: 'GET',
					url: 'http://localhost:5173/api/test',
				},
				cookies: {
					get: (name: string) => {
						return name === '__session' ? 'expired-session' : undefined;
					},
					set: () => {},
					delete: () => {},
					getAll: () => [],
					serialize: () => '',
				},
			});

			const result = await verifyAuthToken(event);

			expect(result).toBeNull();
		});

		it('extracts uid, email, name, emailVerified correctly from decoded token', async () => {
			const decodedToken: DecodedIdToken = {
				iss: 'https://securetoken.google.com/test-project',
				aud: 'test-project',
				auth_time: Math.floor(Date.now() / 1000),
				user_id: 'custom-uid',
				sub: 'custom-uid',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				email: 'custom@example.com',
				email_verified: false,
				name: 'Custom Name',
				uid: 'custom-uid',
				firebase: { sign_in_provider: 'custom' },
			};

			setMockAuthConfig({ idTokenResult: decodedToken });

			const event = createMockRequestEvent();
			const result = await verifyAuthToken(event);

			expect(result?.uid).toBe('custom-uid');
			expect(result?.email).toBe('custom@example.com');
			expect(result?.name).toBe('Custom Name');
			expect(result?.emailVerified).toBe(false);
		});

		it('handles missing email in decoded token (defaults to empty string)', async () => {
			const decodedToken: DecodedIdToken = {
				iss: 'https://securetoken.google.com/test-project',
				aud: 'test-project',
				auth_time: Math.floor(Date.now() / 1000),
				user_id: 'user789',
				sub: 'user789',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				uid: 'user789',
				firebase: { sign_in_provider: 'custom' },
				// email is undefined
			};

			setMockAuthConfig({ idTokenResult: decodedToken });

			const event = createMockRequestEvent();
			const result = await verifyAuthToken(event);

			expect(result?.email).toBe('');
		});

		it('prefers Bearer token over session cookie when both present', async () => {
			const bearerDecodedToken: DecodedIdToken = {
				iss: 'https://securetoken.google.com/test-project',
				aud: 'test-project',
				auth_time: Math.floor(Date.now() / 1000),
				user_id: 'bearer-user',
				sub: 'bearer-user',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 3600,
				email: 'bearer@example.com',
				email_verified: true,
				uid: 'bearer-user',
				firebase: { sign_in_provider: 'custom' },
			};

			setMockAuthConfig({ idTokenResult: bearerDecodedToken });

			const event = createMockRequestEvent({
				cookies: {
					get: (name: string) => {
						return name === '__session' ? 'session-cookie' : undefined;
					},
					set: () => {},
					delete: () => {},
					getAll: () => [],
					serialize: () => '',
				},
			});

			const result = await verifyAuthToken(event);

			expect(result?.uid).toBe('bearer-user');
			expect(result?.email).toBe('bearer@example.com');
		});
	});
});
