import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTokenStats, type PeriodDays } from '$lib/server/admin-dashboard';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const period = (parseInt(url.searchParams.get('period') ?? '30', 10) || 30) as PeriodDays;
	const stats = await getTokenStats(period);
	return json(stats);
};
