import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAuditEvents,
	countAuditEvents,
	groupIntoSessions,
	type AuditPeriod,
} from '$lib/server/admin-audit';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const eventType = url.searchParams.get('event_type') || null;
	const actorId = url.searchParams.get('actor_id') || null;
	const resourceType = url.searchParams.get('resource_type') || null;
	const rawPeriod = Number(url.searchParams.get('period'));
	const period: AuditPeriod = ([7, 30, 90] as const).includes(rawPeriod as AuditPeriod) ? (rawPeriod as AuditPeriod) : 30;
	const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || 100)), 200);
	const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));

	const [events, total] = await Promise.all([
		getAuditEvents(eventType, actorId, resourceType, period, limit, offset),
		countAuditEvents(eventType, actorId, resourceType, period),
	]);
	const sessions = groupIntoSessions(events);

	return json({ events, sessions, total, limit, offset });
};
