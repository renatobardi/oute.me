import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getAuditEvents,
	groupIntoSessions,
	getDistinctEventTypes,
	getDistinctActors,
} from '$lib/server/admin-audit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	try {
		const [events, eventTypes, actors] = await Promise.all([
			getAuditEvents(null, null, null, 30),
			getDistinctEventTypes(),
			getDistinctActors(),
		]);

		return {
			sessions: groupIntoSessions(events),
			total: events.length,
			eventTypes,
			actors,
		};
	} catch (err) {
		console.error('[admin/audit] load error:', err);
		return { sessions: [], total: 0, eventTypes: [], actors: [] };
	}
};
