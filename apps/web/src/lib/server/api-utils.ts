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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuid(id: string | null | undefined): void {
	if (!id || !UUID_RE.test(id)) throw error(400, 'Invalid ID format');
}
