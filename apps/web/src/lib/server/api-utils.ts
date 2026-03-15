import { json, error } from '@sveltejs/kit';
import type { AuthUser } from './auth';

export function requireAuth(locals: App.Locals): AuthUser {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	return locals.user;
}

export function jsonOk<T>(data: T, status: number = 200): Response {
	return json(data, { status });
}

export function jsonError(status: number, message: string): Response {
	return json({ error: message }, { status });
}
