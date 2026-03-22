import type { RequestHandler } from './$types';
import { requireAuth, jsonOk, jsonError } from '$lib/server/api-utils';
import { getConversionFunnel, type PeriodDays } from '$lib/server/admin-dashboard';

export const GET: RequestHandler = async ({ locals, url }) => {
	requireAuth(locals);
	if (!locals.dbUser?.is_admin) return jsonError(403, 'Admin access required');

	const periodParam = url.searchParams.get('period');
	const period = ([7, 30, 90].includes(Number(periodParam)) ? Number(periodParam) : 30) as PeriodDays;

	const funnel = await getConversionFunnel(period);
	return jsonOk(funnel);
};
