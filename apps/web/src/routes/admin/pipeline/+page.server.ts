import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getPipelineRows,
	getAgentHeatmap,
	getPipelineTrend,
	getDistinctModels,
} from '$lib/server/admin-pipeline';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (!locals.dbUser?.is_admin) throw redirect(302, '/interviews');

	try {
		const [rows, heatmap, trend, models] = await Promise.all([
			getPipelineRows('all', null, 30),
			getAgentHeatmap(30),
			getPipelineTrend(30),
			getDistinctModels(),
		]);

		return { rows, heatmap, trend, models };
	} catch (err) {
		console.error('[admin/pipeline] load error:', err);
		return { rows: [], heatmap: [], trend: [], models: [] };
	}
};
