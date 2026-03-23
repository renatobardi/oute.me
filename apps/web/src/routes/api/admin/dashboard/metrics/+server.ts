import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk } from '$lib/server/api-utils';
import { getAdminDashboardMetrics } from '$lib/server/admin-dashboard';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const metrics = await getAdminDashboardMetrics();
	return jsonOk(metrics);
};
