<script lang="ts">
	import { auth } from '$lib/firebase';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { AGENT_LABELS } from '$lib/types/estimate';
	import type { PipelineRow, AgentHeatmapEntry, TrendPoint } from '$lib/server/admin-pipeline';

	let { data } = $props();

	type Period = 7 | 30 | 90;
	type Status = 'all' | 'running' | 'done' | 'failed' | 'pending';

	let period = $state<Period>(30);
	let statusFilter = $state<Status>('all');
	let modelFilter = $state<string>('all');
	let loading = $state(false);

	let rows = $state<PipelineRow[]>(data.rows);
	let heatmap = $state<AgentHeatmapEntry[]>(data.heatmap);
	let trend = $state<TrendPoint[]>(data.trend);
	let models = $state<string[]>(data.models);

	async function refresh() {
		loading = true;
		try {
			const token = (await auth.currentUser?.getIdToken(false)) ?? '';
			const params = new URLSearchParams({
				period: String(period),
				status: statusFilter,
				...(modelFilter !== 'all' ? { model: modelFilter } : {}),
			});
			const res = await fetch(`/api/admin/pipeline?${params}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) {
				const d = await res.json();
				rows = d.rows;
				heatmap = d.heatmap;
				trend = d.trend;
				models = d.models;
			}
		} finally {
			loading = false;
		}
	}

	// Max avg duration for heatmap normalization
	const maxDuration = $derived(
		heatmap.length > 0 ? Math.max(...heatmap.map((h) => h.avg_duration_s)) : 1
	);

	function heatColor(duration: number, max: number): string {
		const ratio = duration / max;
		if (ratio < 0.33) return 'rgba(16, 185, 129, 0.6)';
		if (ratio < 0.66) return 'rgba(245, 158, 11, 0.6)';
		return 'rgba(239, 68, 68, 0.6)';
	}

	// Trend SVG inline chart
	const CHART_W = 400;
	const CHART_H = 80;

	const trendPath = $derived((): string => {
		if (trend.length < 2) return '';
		const maxDur = Math.max(...trend.map((t) => t.avg_duration_s), 1);
		const pts = trend.map((t, i) => {
			const x = (i / (trend.length - 1)) * CHART_W;
			const y = CHART_H - (t.avg_duration_s / maxDur) * (CHART_H - 10) - 5;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		});
		return `M ${pts.join(' L ')}`;
	});

	function fmtDate(d: string) {
		return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
	}

	function agentLabel(key: string) {
		return AGENT_LABELS[key] ?? key;
	}
</script>

<svelte:head>
	<title>Pipeline — oute.pro</title>
</svelte:head>

<div class="page">
	<!-- Filters -->
	<div class="filters">
		<div class="filter-group">
			<label class="filter-label">Período</label>
			<div class="btn-group">
				{#each ([7, 30, 90] as Period[]) as p (p)}
					<button
						class="btn-period"
						class:active={period === p}
						onclick={() => { period = p; refresh(); }}
						type="button"
					>{p}d</button>
				{/each}
			</div>
		</div>

		<div class="filter-group">
			<label class="filter-label" for="filter-status">Status</label>
			<select id="filter-status" class="select" bind:value={statusFilter} onchange={refresh}>
				<option value="all">Todos</option>
				<option value="running">Running</option>
				<option value="done">Done</option>
				<option value="failed">Failed</option>
				<option value="pending">Pending</option>
			</select>
		</div>

		{#if models.length > 0}
			<div class="filter-group">
				<label class="filter-label" for="filter-model">Modelo LLM</label>
				<select id="filter-model" class="select" bind:value={modelFilter} onchange={refresh}>
					<option value="all">Todos</option>
					{#each models as m (m)}
						<option value={m}>{m}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if loading}
			<span class="loading-dot"></span>
		{/if}
	</div>

	<div class="main-grid">
		<!-- Pipeline table -->
		<div class="table-card">
			<div class="card-title">Pipelines ({rows.length})</div>
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Entrevista</th>
							<th>Status</th>
							<th>Modelo</th>
							<th>Duração</th>
							<th>Agente Atual</th>
							<th>Criado em</th>
						</tr>
					</thead>
					<tbody>
						{#if rows.length === 0}
							<tr>
								<td colspan="6" class="empty-row">Nenhum pipeline no período.</td>
							</tr>
						{/if}
						{#each rows as row (row.run_id)}
							<tr>
								<td>
									<a class="interview-link" href="/admin/cockpit/{row.interview_id}">
										{row.interview_title ?? 'Sem título'}
									</a>
									<span class="user-email">{row.user_email}</span>
								</td>
								<td><StatusBadge status={row.run_status} /></td>
								<td class="mono">{row.llm_model ?? '—'}</td>
								<td class="mono">{row.total_duration_s != null ? `${row.total_duration_s.toFixed(1)}s` : '—'}</td>
								<td class="agent-cell">
									{#if row.current_agent}
										<span class="current-agent">{agentLabel(row.current_agent)}</span>
									{:else}
										<span class="muted">—</span>
									{/if}
								</td>
								<td class="muted">{fmtDate(row.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="side-col">
			<!-- Duration heatmap -->
			<div class="card">
				<div class="card-title">Duração Média por Agente</div>
				{#if heatmap.length === 0}
					<p class="empty">Sem dados no período.</p>
				{:else}
					<div class="heatmap">
						{#each heatmap as h (h.agent_key)}
							<div class="heat-row">
								<span class="heat-label">{agentLabel(h.agent_key)}</span>
								<div class="heat-bar-track">
									<div
										class="heat-bar-fill"
										style="width: {Math.round((h.avg_duration_s / maxDuration) * 100)}%; background: {heatColor(h.avg_duration_s, maxDuration)};"
									></div>
								</div>
								<span class="heat-val">{h.avg_duration_s.toFixed(1)}s</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Failure rate by agent -->
			<div class="card">
				<div class="card-title">Taxa de Falha por Agente</div>
				{#if heatmap.length === 0}
					<p class="empty">Sem dados no período.</p>
				{:else}
					<div class="failure-bars">
						{#each heatmap.filter(h => h.total > 0) as h (h.agent_key)}
							{@const pct = Math.round(h.failure_rate * 100)}
							<div class="fail-row">
								<span class="fail-label">{agentLabel(h.agent_key)}</span>
								<div class="fail-track">
									<div
										class="fail-fill"
										style="width: {pct}%;"
										class:fail-ok={pct < 10}
										class:fail-warn={pct >= 10 && pct < 30}
										class:fail-err={pct >= 30}
									></div>
								</div>
								<span class="fail-pct" class:fail-ok={pct < 10} class:fail-warn={pct >= 10 && pct < 30} class:fail-err={pct >= 30}>
									{pct}%
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Trend chart -->
			<div class="card">
				<div class="card-title">Duração Média — últimos {period}d</div>
				{#if trend.length < 2}
					<p class="empty">Dados insuficientes.</p>
				{:else}
					<div class="trend-wrap">
						<svg viewBox="0 0 {CHART_W} {CHART_H}" preserveAspectRatio="none" class="trend-svg">
							<path d={trendPath()} fill="none" stroke="var(--color-primary-400, #818cf8)" stroke-width="2" />
						</svg>
						<div class="trend-labels">
							<span>{fmtDate(trend[0].day)}</span>
							<span>{fmtDate(trend[trend.length - 1].day)}</span>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.page {
		padding: 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Filters */
	.filters {
		display: flex;
		gap: 1.5rem;
		align-items: flex-end;
		flex-wrap: wrap;
		padding: 0.875rem 1rem;
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.filter-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-neutral-500, #6b7280);
	}

	.btn-group {
		display: flex;
		gap: 0.25rem;
	}

	.btn-period {
		padding: 0.3rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
		color: #9ca3af;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-period.active {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.4);
		color: var(--color-primary-400, #818cf8);
	}

	.select {
		padding: 0.3rem 0.6rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		color: #e5e7eb;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.loading-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-primary-400, #818cf8);
		animation: pulse 1s ease-in-out infinite;
		align-self: center;
		margin-left: auto;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50%       { opacity: 1; }
	}

	/* Layout */
	.main-grid {
		display: grid;
		grid-template-columns: 1fr 340px;
		gap: 1rem;
		align-items: start;
	}

	@media (max-width: 1100px) {
		.main-grid { grid-template-columns: 1fr; }
	}

	/* Table */
	.table-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		overflow: hidden;
	}

	.card-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
	}

	.table th {
		text-align: left;
		padding: 0.5rem 0.875rem;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		white-space: nowrap;
	}

	.table td {
		padding: 0.5rem 0.875rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		color: #e5e7eb;
		vertical-align: top;
	}

	.table tr:last-child td { border-bottom: none; }
	.table tr:hover td { background: rgba(255, 255, 255, 0.02); }

	.interview-link {
		display: block;
		color: #f9fafb;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.8125rem;
	}

	.interview-link:hover { color: var(--color-primary-400, #818cf8); }

	.user-email {
		display: block;
		font-size: 0.7rem;
		color: #6b7280;
	}

	.mono { font-family: monospace; }
	.muted { color: #6b7280; font-size: 0.775rem; }

	.current-agent {
		font-size: 0.75rem;
		color: var(--color-primary-400, #818cf8);
	}

	.empty-row {
		text-align: center;
		color: #6b7280;
		padding: 2rem !important;
	}

	/* Side column */
	.side-col {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		padding: 0.875rem 1rem;
	}

	.empty {
		font-size: 0.8125rem;
		color: #6b7280;
		text-align: center;
		margin: 0.5rem 0;
	}

	/* Heatmap */
	.heatmap {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.heat-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
	}

	.heat-label {
		width: 120px;
		flex-shrink: 0;
		color: #9ca3af;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.heat-bar-track {
		flex: 1;
		height: 12px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 9999px;
		overflow: hidden;
	}

	.heat-bar-fill {
		height: 100%;
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.heat-val {
		width: 40px;
		text-align: right;
		font-family: monospace;
		font-size: 0.7rem;
		color: #6b7280;
	}

	/* Failure bars */
	.failure-bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.fail-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
	}

	.fail-label {
		width: 120px;
		flex-shrink: 0;
		color: #9ca3af;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.fail-track {
		flex: 1;
		height: 10px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 9999px;
		overflow: hidden;
	}

	.fail-fill {
		height: 100%;
		border-radius: 9999px;
		min-width: 2px;
	}

	.fail-ok   { background: rgba(16, 185, 129, 0.6); color: #6ee7b7; }
	.fail-warn { background: rgba(245, 158, 11, 0.6); color: #fcd34d; }
	.fail-err  { background: rgba(239, 68, 68, 0.6); color: #fca5a5; }

	.fail-pct {
		width: 30px;
		text-align: right;
		font-family: monospace;
		font-size: 0.7rem;
	}

	/* Trend */
	.trend-wrap {
		margin-top: 0.5rem;
	}

	.trend-svg {
		width: 100%;
		height: 80px;
	}

	.trend-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.65rem;
		color: #6b7280;
		margin-top: 0.25rem;
	}
</style>
