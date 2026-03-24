import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getAdminDashboardMetrics,
	getConversionFunnel,
	getActivePipelines,
	getAdminAlerts,
	getTokenStats,
	emptyMetrics,
	emptyTokenStats,
} from '$lib/server/admin-dashboard';

async function safe<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		console.error(`[admin/dashboard] ${label} failed:`, err);
		return fallback;
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	const [metrics, funnel, pipelines, alerts, tokenStats] = await Promise.all([
		safe(() => getAdminDashboardMetrics(), emptyMetrics(), 'metrics'),
		safe(() => getConversionFunnel(30), [], 'funnel'),
		safe(() => getActivePipelines(), [], 'pipelines'),
		safe(() => getAdminAlerts(), [], 'alerts'),
		safe(() => getTokenStats(30), emptyTokenStats(30), 'tokenStats'),
	]);

	return { metrics, funnel, pipelines, alerts, tokenStats };
};
