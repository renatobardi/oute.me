import sql from './db';

export type AuditPeriod = 7 | 30 | 90;

export interface AuditEvent {
	id: string;
	event_type: string;
	actor_id: string | null;
	actor_email: string | null;
	resource_type: string;
	resource_id: string | null;
	details: Record<string, unknown>;
	created_at: string;
}

export interface AuditSession {
	session_start: string;
	events: AuditEvent[];
}

const SESSION_GAP_MINUTES = 30;

export async function getAuditEvents(
	eventType: string | null,
	actorId: string | null,
	resourceType: string | null,
	period: AuditPeriod = 30,
	limit = 200
): Promise<AuditEvent[]> {
	return sql<AuditEvent[]>`
		SELECT
			e.id::text,
			e.event_type,
			e.actor_id::text,
			u.email AS actor_email,
			e.resource_type,
			e.resource_id::text,
			e.details,
			e.created_at
		FROM   audit.event_log e
		LEFT JOIN public.users u ON u.id = e.actor_id
		WHERE  e.created_at > NOW() - (${period} || ' days')::interval
		  AND  (${eventType} IS NULL OR e.event_type = ${eventType})
		  AND  (${actorId}   IS NULL OR e.actor_id::text = ${actorId})
		  AND  (${resourceType} IS NULL OR e.resource_type = ${resourceType})
		ORDER  BY e.created_at DESC
		LIMIT  ${limit}
	`;
}

export function groupIntoSessions(events: AuditEvent[]): AuditSession[] {
	if (events.length === 0) return [];

	const sessions: AuditSession[] = [];
	let current: AuditEvent[] = [events[0]];

	for (let i = 1; i < events.length; i++) {
		const prev = new Date(events[i - 1].created_at).getTime();
		const curr = new Date(events[i].created_at).getTime();
		const gapMinutes = (prev - curr) / 60_000; // events are DESC order

		if (gapMinutes > SESSION_GAP_MINUTES) {
			sessions.push({ session_start: current[0].created_at, events: current });
			current = [events[i]];
		} else {
			current.push(events[i]);
		}
	}
	sessions.push({ session_start: current[0].created_at, events: current });

	return sessions;
}

export async function getDistinctEventTypes(): Promise<string[]> {
	const rows = await sql<{ event_type: string }[]>`
		SELECT DISTINCT event_type FROM audit.event_log ORDER BY event_type
	`;
	return rows.map((r) => r.event_type);
}

export async function getDistinctActors(): Promise<{ id: string; email: string }[]> {
	return sql<{ id: string; email: string }[]>`
		SELECT DISTINCT u.id::text AS id, u.email
		FROM   audit.event_log e
		JOIN   public.users u ON u.id = e.actor_id
		ORDER  BY u.email
	`;
}
