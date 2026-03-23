import sql from './db';

export interface DashboardMetrics {
	users: {
		total: number;
		active: number;
		signups_last_7d: number;
	};
	interviews: {
		total: number;
		active: number;
		mature: number;
		avg_maturity: number;
		avg_messages: number;
	};
	estimates: {
		total: number;
		done: number;
		failed: number;
		pending: number;
		avg_duration_s: number | null;
		failure_rate: number;
	};
	projects: {
		total: number;
		active: number;
	};
}

export interface FunnelStep {
	label: string;
	count: number;
	rate: number | null; // conversion rate from previous step
}

export interface ActivePipeline {
	job_id: string | null;
	interview_id: string;
	interview_title: string | null;
	user_email: string;
	estimate_id: string;
	estimate_status: string;
	agent_steps: Array<{
		agent_key: string;
		status: string;
		duration_s: number | null;
		error: string | null;
	}>;
	started_at: string;
	elapsed_s: number;
}

export interface AdminAlert {
	type: 'pipeline_failed' | 'stale_interview' | 'stuck_job';
	severity: 'high' | 'medium';
	interview_id: string;
	interview_title: string | null;
	user_email: string;
	detail: string;
	occurred_at: string;
}

export type PeriodDays = 7 | 30 | 90;

export async function getAdminDashboardMetrics(): Promise<DashboardMetrics> {
	const [userRows, interviewRows, estimateRows, projectRows] = await Promise.all([
		sql<{ total: string; active: string; signups_7d: string }[]>`
			SELECT
				COUNT(*)::text AS total,
				COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS active,
				COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS signups_7d
			FROM public.users
		`,
		sql<{ total: string; active: string; mature: string; avg_maturity: string; avg_messages: string }[]>`
			SELECT
				COUNT(*)::text AS total,
				COUNT(*) FILTER (WHERE status = 'active')::text AS active,
				COUNT(*) FILTER (WHERE maturity >= 0.70)::text AS mature,
				COALESCE(AVG(maturity), 0)::text AS avg_maturity,
				COALESCE((
					SELECT AVG(msg_count) FROM (
						SELECT interview_id, COUNT(*) AS msg_count
						FROM public.interview_messages
						GROUP BY interview_id
					) mc
				), 0)::text AS avg_messages
			FROM public.interviews
		`,
		sql<{ total: string; done: string; failed: string; pending: string; avg_duration_s: string | null; failure_rate: string }[]>`
			SELECT
				COUNT(*)::text AS total,
				COUNT(*) FILTER (WHERE status IN ('done', 'approved'))::text AS done,
				COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
				COUNT(*) FILTER (WHERE status IN ('pending_approval', 'estimating', 'running'))::text AS pending,
				AVG(
					EXTRACT(EPOCH FROM (updated_at - created_at))
				) FILTER (WHERE status IN ('done', 'approved'))::text AS avg_duration_s,
				CASE WHEN COUNT(*) > 0
					THEN (COUNT(*) FILTER (WHERE status = 'failed')::float / COUNT(*))
					ELSE 0
				END::text AS failure_rate
			FROM public.estimates
		`,
		sql<{ total: string; active: string }[]>`
			SELECT
				COUNT(*)::text AS total,
				COUNT(*) FILTER (WHERE status = 'active')::text AS active
			FROM public.projects
		`,
	]);

	const u = userRows[0];
	const iv = interviewRows[0];
	const est = estimateRows[0];
	const proj = projectRows[0];

	return {
		users: {
			total: parseInt(u?.total ?? '0'),
			active: parseInt(u?.active ?? '0'),
			signups_last_7d: parseInt(u?.signups_7d ?? '0'),
		},
		interviews: {
			total: parseInt(iv?.total ?? '0'),
			active: parseInt(iv?.active ?? '0'),
			mature: parseInt(iv?.mature ?? '0'),
			avg_maturity: parseFloat(iv?.avg_maturity ?? '0'),
			avg_messages: parseFloat(iv?.avg_messages ?? '0'),
		},
		estimates: {
			total: parseInt(est?.total ?? '0'),
			done: parseInt(est?.done ?? '0'),
			failed: parseInt(est?.failed ?? '0'),
			pending: parseInt(est?.pending ?? '0'),
			avg_duration_s: est?.avg_duration_s != null ? parseFloat(est.avg_duration_s) : null,
			failure_rate: parseFloat(est?.failure_rate ?? '0'),
		},
		projects: {
			total: parseInt(proj?.total ?? '0'),
			active: parseInt(proj?.active ?? '0'),
		},
	};
}

export async function getConversionFunnel(period: PeriodDays = 30): Promise<FunnelStep[]> {
	const interval = `${period} days`;

	const [ivRows, estRows, projRows] = await Promise.all([
		sql<{ created: string; mature: string }[]>`
			SELECT
				COUNT(*) FILTER (WHERE created_at >= NOW() - ${interval}::interval)::text AS created,
				COUNT(*) FILTER (WHERE maturity >= 0.70 AND created_at >= NOW() - ${interval}::interval)::text AS mature
			FROM public.interviews
		`,
		sql<{ triggered: string; completed: string; approved: string }[]>`
			SELECT
				COUNT(*) FILTER (WHERE created_at >= NOW() - ${interval}::interval)::text AS triggered,
				COUNT(*) FILTER (WHERE status IN ('done', 'approved') AND created_at >= NOW() - ${interval}::interval)::text AS completed,
				COUNT(*) FILTER (WHERE status = 'approved' AND created_at >= NOW() - ${interval}::interval)::text AS approved
			FROM public.estimates
		`,
		sql<{ created: string }[]>`
			SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - ${interval}::interval)::text AS created
			FROM public.projects
		`,
	]);

	const created = parseInt(ivRows[0]?.created ?? '0');
	const mature = parseInt(ivRows[0]?.mature ?? '0');
	const triggered = parseInt(estRows[0]?.triggered ?? '0');
	const completed = parseInt(estRows[0]?.completed ?? '0');
	const approved = parseInt(estRows[0]?.approved ?? '0');
	const projects = parseInt(projRows[0]?.created ?? '0');

	const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) / 100 : null);

	return [
		{ label: 'Entrevistas', count: created, rate: null },
		{ label: 'Maduras (≥70%)', count: mature, rate: rate(mature, created) },
		{ label: 'Estimativas', count: triggered, rate: rate(triggered, mature) },
		{ label: 'Concluídas', count: completed, rate: rate(completed, triggered) },
		{ label: 'Aprovadas', count: approved, rate: rate(approved, completed) },
		{ label: 'Projetos', count: projects, rate: rate(projects, approved) },
	];
}

export async function getActivePipelines(): Promise<ActivePipeline[]> {
	const rows = await sql<{
		estimate_id: string;
		interview_id: string;
		interview_title: string | null;
		user_email: string;
		estimate_status: string;
		job_id: string | null;
		agent_steps: unknown;
		started_at: Date;
	}[]>`
		SELECT
			e.id AS estimate_id,
			i.id AS interview_id,
			i.title AS interview_title,
			u.email AS user_email,
			e.status AS estimate_status,
			e.job_id,
			e.agent_steps,
			e.created_at AS started_at
		FROM public.estimates e
		JOIN public.interviews i ON i.id = e.interview_id
		JOIN public.users u ON u.id = i.user_id
		WHERE e.status IN ('estimating', 'running', 'pending')
		ORDER BY e.created_at DESC
		LIMIT 20
	`;

	const now = Date.now();
	return rows.map((r) => ({
		job_id: r.job_id,
		interview_id: r.interview_id,
		interview_title: r.interview_title,
		user_email: r.user_email,
		estimate_id: r.estimate_id,
		estimate_status: r.estimate_status,
		agent_steps: (Array.isArray(r.agent_steps) ? r.agent_steps : []) as ActivePipeline['agent_steps'],
		started_at: r.started_at.toISOString(),
		elapsed_s: Math.floor((now - new Date(r.started_at).getTime()) / 1000),
	}));
}

export async function getAdminAlerts(): Promise<AdminAlert[]> {
	const [failedRows, staleRows, stuckRows] = await Promise.all([
		// Pipelines falhados nas últimas 24h
		sql<{ interview_id: string; interview_title: string | null; user_email: string; updated_at: Date }[]>`
			SELECT
				i.id AS interview_id,
				i.title AS interview_title,
				u.email AS user_email,
				e.updated_at
			FROM public.estimates e
			JOIN public.interviews i ON i.id = e.interview_id
			JOIN public.users u ON u.id = i.user_id
			WHERE e.status = 'failed'
			  AND e.updated_at >= NOW() - INTERVAL '24 hours'
			ORDER BY e.updated_at DESC
			LIMIT 10
		`,
		// Entrevistas ativas paradas >48h sem atividade
		sql<{ interview_id: string; interview_title: string | null; user_email: string; updated_at: Date }[]>`
			SELECT
				i.id AS interview_id,
				i.title AS interview_title,
				u.email AS user_email,
				i.updated_at
			FROM public.interviews i
			JOIN public.users u ON u.id = i.user_id
			WHERE i.status = 'active'
			  AND i.maturity < 0.70
			  AND i.updated_at < NOW() - INTERVAL '48 hours'
			  AND NOT EXISTS (
			      SELECT 1 FROM public.estimates e
			      WHERE e.interview_id = i.id AND e.status IN ('done', 'approved', 'estimating', 'running')
			  )
			ORDER BY i.updated_at ASC
			LIMIT 10
		`,
		// Jobs em running há mais de 5 minutos (possível stale)
		sql<{ interview_id: string; interview_title: string | null; user_email: string; updated_at: Date }[]>`
			SELECT
				i.id AS interview_id,
				i.title AS interview_title,
				u.email AS user_email,
				e.updated_at
			FROM public.estimates e
			JOIN public.interviews i ON i.id = e.interview_id
			JOIN public.users u ON u.id = i.user_id
			WHERE e.status IN ('estimating', 'running')
			  AND e.updated_at < NOW() - INTERVAL '5 minutes'
			ORDER BY e.updated_at ASC
			LIMIT 5
		`,
	]);

	const alerts: AdminAlert[] = [
		...failedRows.map((r) => ({
			type: 'pipeline_failed' as const,
			severity: 'high' as const,
			interview_id: r.interview_id,
			interview_title: r.interview_title,
			user_email: r.user_email,
			detail: 'Pipeline falhou',
			occurred_at: r.updated_at.toISOString(),
		})),
		...staleRows.map((r) => ({
			type: 'stale_interview' as const,
			severity: 'medium' as const,
			interview_id: r.interview_id,
			interview_title: r.interview_title,
			user_email: r.user_email,
			detail: 'Entrevista parada >48h sem atingir maturidade',
			occurred_at: r.updated_at.toISOString(),
		})),
		...stuckRows.map((r) => ({
			type: 'stuck_job' as const,
			severity: 'high' as const,
			interview_id: r.interview_id,
			interview_title: r.interview_title,
			user_email: r.user_email,
			detail: 'Pipeline em running há >5min (possível stale)',
			occurred_at: r.updated_at.toISOString(),
		})),
	];

	return alerts.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
}

export interface TokenStats {
	period: number;
	total_tokens: number;
	avg_tokens_per_interview: number;
	daily_trend: { day: string; tokens: number }[];
	top_interviews: { interview_id: string; title: string | null; user_email: string; tokens: number }[];
}

export async function getTokenStats(period: PeriodDays = 30): Promise<TokenStats> {
	const interval = `${period} days`;

	const [summaryRows, trendRows, topRows] = await Promise.all([
		sql<{ total_tokens: string; distinct_interviews: string }[]>`
			SELECT
				COALESCE(SUM(m.tokens_used), 0)::text AS total_tokens,
				COUNT(DISTINCT m.interview_id)::text AS distinct_interviews
			FROM public.interview_messages m
			WHERE m.created_at >= NOW() - ${interval}::interval
			  AND m.tokens_used > 0
		`,
		sql<{ day: string; tokens: string }[]>`
			SELECT
				DATE_TRUNC('day', m.created_at)::date::text AS day,
				SUM(m.tokens_used)::text AS tokens
			FROM public.interview_messages m
			WHERE m.created_at >= NOW() - ${interval}::interval
			  AND m.tokens_used > 0
			GROUP BY 1
			ORDER BY 1 ASC
		`,
		sql<{ interview_id: string; title: string | null; user_email: string; tokens: string }[]>`
			SELECT
				i.id AS interview_id,
				i.title,
				u.email AS user_email,
				SUM(m.tokens_used)::text AS tokens
			FROM public.interview_messages m
			JOIN public.interviews i ON i.id = m.interview_id
			JOIN public.users u ON u.id = i.user_id
			WHERE m.created_at >= NOW() - ${interval}::interval
			  AND m.tokens_used > 0
			GROUP BY i.id, i.title, u.email
			ORDER BY SUM(m.tokens_used) DESC
			LIMIT 5
		`,
	]);

	const totalTokens = parseInt(summaryRows[0]?.total_tokens ?? '0');
	const distinctInterviews = parseInt(summaryRows[0]?.distinct_interviews ?? '0');

	return {
		period,
		total_tokens: totalTokens,
		avg_tokens_per_interview: distinctInterviews > 0 ? Math.round(totalTokens / distinctInterviews) : 0,
		daily_trend: trendRows.map((r) => ({ day: r.day, tokens: parseInt(r.tokens) })),
		top_interviews: topRows.map((r) => ({
			interview_id: r.interview_id,
			title: r.title,
			user_email: r.user_email,
			tokens: parseInt(r.tokens),
		})),
	};
}
