import sql from './db';

export type PipelineStatus = 'all' | 'running' | 'done' | 'failed' | 'pending';
export type PipelinePeriod = 7 | 30 | 90;

export interface PipelineRow {
	run_id: string;
	run_status: string;
	llm_model: string | null;
	total_duration_s: number | null;
	created_at: string;
	completed_at: string | null;
	estimate_id: string;
	estimate_status: string;
	interview_id: string;
	interview_title: string | null;
	user_email: string;
	current_agent: string | null;
}

export interface AgentHeatmapEntry {
	agent_key: string;
	avg_duration_s: number;
	failures: number;
	total: number;
	failure_rate: number;
}

export interface TrendPoint {
	day: string;
	avg_duration_s: number;
	count: number;
}

export async function getPipelineRows(
	status: PipelineStatus = 'all',
	llmModel: string | null = null,
	period: PipelinePeriod = 30,
	limit = 100
): Promise<PipelineRow[]> {
	const interval = `${period} days`;
	return sql<PipelineRow[]>`
		SELECT
			er.id                       AS run_id,
			er.status                   AS run_status,
			er.llm_model,
			er.total_duration_s,
			er.created_at,
			er.completed_at,
			e.id                        AS estimate_id,
			e.status                    AS estimate_status,
			i.id                        AS interview_id,
			i.title                     AS interview_title,
			u.email                     AS user_email,
			(
				SELECT s->>'agent_key'
				FROM   jsonb_array_elements(er.agent_steps::jsonb) s
				WHERE  s->>'status' = 'running'
				LIMIT  1
			)                           AS current_agent
		FROM   public.estimate_runs er
		JOIN   public.estimates  e  ON e.id  = er.estimate_id
		JOIN   public.interviews i  ON i.id  = e.interview_id
		JOIN   public.users      u  ON u.id  = i.user_id
		WHERE  er.created_at > NOW() - ${interval}::interval
		  AND  (${status} = 'all'  OR er.status = ${status})
		  AND  (${llmModel} IS NULL OR er.llm_model = ${llmModel})
		ORDER  BY er.created_at DESC
		LIMIT  ${limit}
	`;
}

export async function getAgentHeatmap(period: PipelinePeriod = 30): Promise<AgentHeatmapEntry[]> {
	const interval = `${period} days`;
	const rows = await sql<{ agent_key: string; avg_dur: string; failures: string; total: string }[]>`
		SELECT
			s->>'agent_key'                                                   AS agent_key,
			AVG((s->>'duration_s')::float)::text                              AS avg_dur,
			COUNT(*) FILTER (WHERE s->>'status' = 'failed')::text             AS failures,
			COUNT(*)::text                                                     AS total
		FROM   public.estimate_runs er,
		       jsonb_array_elements(er.agent_steps::jsonb) s
		WHERE  er.status = 'done'
		  AND  er.created_at > NOW() - ${interval}::interval
		GROUP  BY s->>'agent_key'
		ORDER  BY agent_key
	`;

	return rows.map((r) => {
		const total = parseInt(r.total, 10);
		const failures = parseInt(r.failures, 10);
		return {
			agent_key: r.agent_key,
			avg_duration_s: parseFloat(r.avg_dur ?? '0'),
			failures,
			total,
			failure_rate: total > 0 ? failures / total : 0,
		};
	});
}

export async function getPipelineTrend(period: PipelinePeriod = 30): Promise<TrendPoint[]> {
	const interval = `${period} days`;
	const rows = await sql<{ day: string; avg_dur: string; count: string }[]>`
		SELECT
			DATE_TRUNC('day', created_at)::text  AS day,
			AVG(total_duration_s)::text          AS avg_dur,
			COUNT(*)::text                       AS count
		FROM   public.estimate_runs
		WHERE  status = 'done'
		  AND  created_at > NOW() - ${interval}::interval
		GROUP  BY 1
		ORDER  BY 1
	`;

	return rows.map((r) => ({
		day: r.day.slice(0, 10),
		avg_duration_s: parseFloat(r.avg_dur ?? '0'),
		count: parseInt(r.count, 10),
	}));
}

export async function getDistinctModels(): Promise<string[]> {
	const rows = await sql<{ llm_model: string }[]>`
		SELECT DISTINCT llm_model
		FROM   public.estimate_runs
		WHERE  llm_model IS NOT NULL
		ORDER  BY llm_model
	`;
	return rows.map((r) => r.llm_model);
}
