import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { jsonOk } from '$lib/server/api-utils';
import { getConversionFunnel, type PeriodDays } from '$lib/server/admin-dashboard';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const periodParam = url.searchParams.get('period');
	const period = ([7, 30, 90].includes(Number(periodParam)) ? Number(periodParam) : 30) as PeriodDays;

	const funnel = await getConversionFunnel(period);
	return jsonOk(funnel);
};
