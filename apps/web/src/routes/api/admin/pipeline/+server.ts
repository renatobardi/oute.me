import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getPipelineRows,
	getAgentHeatmap,
	getPipelineTrend,
	getDistinctModels,
	type PipelineStatus,
	type PipelinePeriod,
} from '$lib/server/admin-pipeline';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.dbUser?.is_admin) throw error(403, 'Forbidden');

	const status = (url.searchParams.get('status') ?? 'all') as PipelineStatus;
	const llmModel = url.searchParams.get('model') || null;
	const rawPeriod = Number(url.searchParams.get('period'));
	const period: PipelinePeriod = ([7, 30, 90] as const).includes(rawPeriod as PipelinePeriod) ? (rawPeriod as PipelinePeriod) : 30;

	const [rows, heatmap, trend, models] = await Promise.all([
		getPipelineRows(status, llmModel, period),
		getAgentHeatmap(period),
		getPipelineTrend(period),
		getDistinctModels(),
	]);

	return json({ rows, heatmap, trend, models });
};
