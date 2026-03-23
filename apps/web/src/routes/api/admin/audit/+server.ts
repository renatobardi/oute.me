import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAuditEvents,
	groupIntoSessions,
	type AuditPeriod,
} from '$lib/server/admin-audit';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const eventType = url.searchParams.get('event_type') || null;
	const actorId = url.searchParams.get('actor_id') || null;
	const resourceType = url.searchParams.get('resource_type') || null;
	const period = (parseInt(url.searchParams.get('period') ?? '30', 10) || 30) as AuditPeriod;

	const events = await getAuditEvents(eventType, actorId, resourceType, period);
	const sessions = groupIntoSessions(events);

	return json({ events, sessions, total: events.length });
};
