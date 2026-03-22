import sql from './db';

interface AuditEvent {
	eventType: string;
	actorId?: string;
	resourceType: string;
	resourceId?: string;
	details?: Record<string, unknown>;
	ipAddress?: string;
	userAgent?: string;
}

export type BusinessEvent =
	| 'interview.created'
	| 'interview.maturity_reached'
	| 'interview.document_uploaded'
	| 'estimate.triggered'
	| 'estimate.completed'
	| 'estimate.failed'
	| 'estimate.approved'
	| 'project.created'
	| 'user.activated';

export function logBusinessEvent(
	eventType: BusinessEvent,
	actorId: string,
	resourceType: string,
	resourceId: string,
	details: Record<string, unknown> = {},
): Promise<void> {
	return logAuditEvent({ eventType, actorId, resourceType, resourceId, details });
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
	try {
		await sql`
			INSERT INTO audit.event_log (
				event_type, actor_id, resource_type, resource_id,
				details, ip_address, user_agent
			)
			VALUES (
				${event.eventType},
				${event.actorId ?? null},
				${event.resourceType},
				${event.resourceId ?? null},
				${sql.json(JSON.parse(JSON.stringify(event.details ?? {})))},
				${event.ipAddress ?? null},
				${event.userAgent ?? null}
			)
		`;
	} catch {
		// Never let audit logging break the request
		console.error('Failed to write audit log:', event.eventType);
	}
}
