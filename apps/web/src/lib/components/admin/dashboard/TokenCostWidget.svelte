<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { TokenStats } from '$lib/server/admin-dashboard';

	let { stats: initialStats }: { stats: TokenStats } = $props();

	let stats = $state<TokenStats>(initialStats);
	let period = $state<7 | 30 | 90>(30);
	let loading = $state(false);

	async function refresh(p: 7 | 30 | 90) {
		period = p;
		loading = true;
		try {
			const token = (await auth.currentUser?.getIdToken(false)) ?? '';
			const res = await fetch(`/api/admin/dashboard/tokens?period=${p}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) stats = await res.json();
		} finally {
			loading = false;
		}
	}

	function fmtTokens(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
		return String(n);
	}

	function fmtCost(usd: number): string {
		if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
		return `$${usd.toFixed(3)}`;
	}

	const AGENT_LABELS: Record<string, string> = {
		architecture_interviewer: 'Entrevistador',
		rag_analyst: 'RAG Analyst',
		software_architect: 'Arquiteto',
		cost_specialist: 'Custos',
		reviewer: 'Revisor',
		knowledge_manager: 'Knowledge',
	};

	// SVG sparkline
	const W = 260;
	const H = 44;
	const PAD = 4;

	const sparkPath = $derived(() => {
		const trend = stats.daily_trend;
		if (trend.length < 2) return '';
		const maxVal = Math.max(...trend.map((d) => d.tokens), 1);
		const xs = trend.map((_, i) => PAD + (i / (trend.length - 1)) * (W - PAD * 2));
		const ys = trend.map((d) => H - PAD - ((d.tokens / maxVal) * (H - PAD * 2)));
		return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
	});

	const totalPipelineCost = $derived(
		stats.pipeline_by_agent.reduce((s, r) => s + r.estimated_cost_usd, 0)
	);

	const maxAgentTokens = $derived(
		Math.max(...stats.pipeline_by_agent.map((r) => r.input_tokens + r.output_tokens), 1)
	);
</script>

<div class="widget">
	<div class="widget-header">
		<span class="widget-title">Tokens & Custo</span>
		<div class="period-group">
			{#each ([7, 30, 90] as const) as p (p)}
				<button
					class="period-btn"
					class:active={period === p}
					onclick={() => refresh(p)}
					type="button"
					disabled={loading}
				>{p}d</button>
			{/each}
		</div>
	</div>

	<!-- Summary row -->
	<div class="summary-row">
		<div class="metric">
			<div class="metric-value">{fmtTokens(stats.total_tokens)}</div>
			<div class="metric-label">tokens totais</div>
		</div>
		<div class="metric">
			<div class="metric-value cost">{fmtCost(totalPipelineCost)}</div>
			<div class="metric-label">custo pipeline*</div>
		</div>
	</div>

	<!-- Chat vs Pipeline split -->
	{#if stats.total_tokens > 0}
		<div class="split-bar-wrap">
			<div class="split-bar">
				{#if stats.chat_tokens > 0}
					<div
						class="split-segment chat"
						style="width: {Math.round((stats.chat_tokens / stats.total_tokens) * 100)}%"
						title="Chat: {fmtTokens(stats.chat_tokens)}"
					></div>
				{/if}
				{#if stats.pipeline_tokens > 0}
					<div
						class="split-segment pipeline"
						style="width: {Math.round((stats.pipeline_tokens / stats.total_tokens) * 100)}%"
						title="Pipeline: {fmtTokens(stats.pipeline_tokens)}"
					></div>
				{/if}
			</div>
			<div class="split-legend">
				<span class="legend-dot chat"></span><span class="legend-label">Chat {fmtTokens(stats.chat_tokens)}</span>
				<span class="legend-dot pipeline"></span><span class="legend-label">Pipeline {fmtTokens(stats.pipeline_tokens)}</span>
			</div>
		</div>
	{/if}

	<!-- Sparkline (chat daily) -->
	{#if stats.daily_trend.length >= 2}
		<div class="sparkline-wrap">
			<svg viewBox="0 0 {W} {H}" width={W} height={H} class="sparkline">
				{#if sparkPath()}
					<defs>
						<linearGradient id="spark-fill-tcw" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stop-color="#818cf8" stop-opacity="0.2" />
							<stop offset="100%" stop-color="#818cf8" stop-opacity="0" />
						</linearGradient>
					</defs>
					{@const area = sparkPath() + ` L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`}
					<path d={area} fill="url(#spark-fill-tcw)" />
					<path d={sparkPath()} fill="none" stroke="#818cf8" stroke-width="1.5" stroke-linejoin="round" />
				{/if}
			</svg>
			<div class="sparkline-labels">
				<span class="spark-label">{stats.daily_trend[0]?.day?.slice(5)}</span>
				<span class="spark-label">{stats.daily_trend.at(-1)?.day?.slice(5)}</span>
			</div>
		</div>
	{/if}

	<!-- Per-agent pipeline breakdown -->
	{#if stats.pipeline_by_agent.length > 0}
		<div class="section">
			<div class="section-title">Pipeline por agente</div>
			{#each stats.pipeline_by_agent as row (row.agent_key)}
				{@const total = row.input_tokens + row.output_tokens}
				<div class="agent-row">
					<div class="agent-info">
						<span class="agent-name">{AGENT_LABELS[row.agent_key] ?? row.agent_key}</span>
						<span class="agent-cost">{fmtCost(row.estimated_cost_usd)}</span>
					</div>
					<div class="agent-bar-wrap">
						<div class="agent-bar" style="width: {Math.round((total / maxAgentTokens) * 100)}%"></div>
						<span class="agent-tokens">{fmtTokens(total)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Top chat consumers -->
	{#if stats.top_interviews.length > 0}
		<div class="section">
			<div class="section-title">Top entrevistas (chat)</div>
			{#each stats.top_interviews as iv (iv.interview_id)}
				<div class="top-row">
					<a class="top-link" href="/admin/cockpit/{iv.interview_id}">
						{iv.title ?? iv.interview_id.slice(0, 8)}
					</a>
					<span class="top-tokens">{fmtTokens(iv.tokens)}</span>
				</div>
			{/each}
		</div>
	{/if}

	<div class="disclaimer">* estimativa baseada em pricing Vertex AI (pode divergir)</div>
</div>

<style>
	.widget {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.widget-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.widget-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f3f4f6;
	}

	.period-group { display: flex; gap: 0.2rem; }

	.period-btn {
		padding: 0.2rem 0.55rem;
		border-radius: 5px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
		color: #9ca3af;
		font-size: 0.72rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.period-btn.active {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.4);
		color: #818cf8;
	}

	.period-btn:disabled { opacity: 0.5; cursor: default; }

	.summary-row { display: flex; gap: 1.5rem; }

	.metric-value {
		font-size: 1.375rem;
		font-weight: 700;
		color: #f9fafb;
		line-height: 1;
	}

	.metric-value.cost { color: #34d399; }

	.metric-label { font-size: 0.7rem; color: #6b7280; margin-top: 0.2rem; }

	/* Split bar */
	.split-bar-wrap { display: flex; flex-direction: column; gap: 0.3rem; }

	.split-bar {
		height: 6px;
		border-radius: 3px;
		background: rgba(255,255,255,0.06);
		display: flex;
		overflow: hidden;
	}

	.split-segment { height: 100%; transition: width 0.3s; }
	.split-segment.chat { background: #818cf8; }
	.split-segment.pipeline { background: #34d399; }

	.split-legend {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.legend-dot.chat { background: #818cf8; }
	.legend-dot.pipeline { background: #34d399; }

	.legend-label { font-size: 0.68rem; color: #9ca3af; }

	/* Sparkline */
	.sparkline-wrap { display: flex; flex-direction: column; gap: 0.125rem; }
	.sparkline { display: block; }
	.sparkline-labels { display: flex; justify-content: space-between; }
	.spark-label { font-size: 0.65rem; color: #6b7280; }

	/* Sections */
	.section { display: flex; flex-direction: column; gap: 0.35rem; }

	.section-title {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
	}

	/* Agent rows */
	.agent-row { display: flex; flex-direction: column; gap: 0.15rem; }

	.agent-info {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.agent-name { font-size: 0.72rem; color: #d1d5db; }
	.agent-cost { font-size: 0.68rem; color: #34d399; }

	.agent-bar-wrap { display: flex; align-items: center; gap: 0.4rem; }

	.agent-bar {
		height: 4px;
		background: rgba(52, 211, 153, 0.45);
		border-radius: 2px;
		min-width: 2px;
		transition: width 0.3s;
	}

	.agent-tokens { font-size: 0.65rem; color: #6b7280; white-space: nowrap; }

	/* Top interviews */
	.top-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.top-link {
		font-size: 0.72rem;
		color: #818cf8;
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 160px;
	}

	.top-link:hover { text-decoration: underline; }

	.top-tokens { font-size: 0.68rem; color: #6b7280; white-space: nowrap; }

	.disclaimer {
		font-size: 0.62rem;
		color: #4b5563;
		font-style: italic;
	}
</style>
