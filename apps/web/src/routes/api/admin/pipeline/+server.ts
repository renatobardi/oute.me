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
	const period = (parseInt(url.searchParams.get('period') ?? '30', 10) || 30) as PipelinePeriod;

	const [rows, heatmap, trend, models] = await Promise.all([
		getPipelineRows(status, llmModel, period),
		getAgentHeatmap(period),
		getPipelineTrend(period),
		getDistinctModels(),
	]);

	return json({ rows, heatmap, trend, models });
};
