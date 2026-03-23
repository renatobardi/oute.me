import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTokenStats, type PeriodDays } from '$lib/server/admin-dashboard';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const raw = Number(url.searchParams.get('period'));
	const period: PeriodDays = ([7, 30, 90] as const).includes(raw as PeriodDays) ? (raw as PeriodDays) : 30;
	const stats = await getTokenStats(period);
	return json(stats);
};
