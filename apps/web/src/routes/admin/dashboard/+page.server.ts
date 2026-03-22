import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getAdminDashboardMetrics,
	getConversionFunnel,
	getActivePipelines,
	getAdminAlerts,
} from '$lib/server/admin-dashboard';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const [metrics, funnel, pipelines, alerts] = await Promise.all([
		getAdminDashboardMetrics(),
		getConversionFunnel(30),
		getActivePipelines(),
		getAdminAlerts(),
	]);

	return { metrics, funnel, pipelines, alerts };
};
