<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { EstimateRun } from '$lib/types/estimate';
	import { AGENT_LABELS } from '$lib/types/estimate';
	import AgentStepCard from './AgentStepCard.svelte';

	interface CompareResult {
		run_a: EstimateRun;
		run_b: EstimateRun;
		diffs: Record<string, { changed: boolean; fields: string[] }>;
		step_durations: Record<string, { a: number | null; b: number | null; delta: number | null }>;
		cost_delta: Record<string, { a: number | null; b: number | null; delta_pct: number | null }>;
		summary: {
			changed_agents: number;
			total_agents: number;
			duration_a: number | null;
			duration_b: number | null;
			duration_delta: number | null;
		};
	}

	let {
		interviewId,
		runAId,
		runBId,
		onclose,
	}: {
		interviewId: string;
		runAId: string;
		runBId: string;
		onclose: () => void;
	} = $props();

	let result = $state<CompareResult | null>(null);
	let loading = $state(true);
	let loadErr = $state<string | null>(null);
	let expandedAgent = $state<string | null>(null);

	$effect(() => {
		void runAId;
		void runBId;
		loadComparison();
	});

	async function loadComparison() {
		loading = true;
		loadErr = null;
		result = null;
		try {
			const token = (await auth.currentUser?.getIdToken(false)) ?? '';
			const res = await fetch(
				`/api/admin/cockpit/interviews/${interviewId}/runs/compare?a=${runAId}&b=${runBId}`,
				{ headers: token ? { Authorization: `Bearer ${token}` } : {} }
			);
			if (!res.ok) throw new Error(await res.text());
			result = await res.json();
		} catch (e) {
			loadErr = e instanceof Error ? e.message : 'Erro ao carregar comparação';
		} finally {
			loading = false;
		}
	}

	function fmtDelta(delta: number | null) {
		if (delta == null) return '—';
		const sign = delta > 0 ? '+' : '';
		return `${sign}${delta.toFixed(1)}s`;
	}

	function deltaClass(delta: number | null) {
		if (delta == null) return '';
		return delta > 0 ? 'delta-worse' : delta < 0 ? 'delta-better' : '';
	}

	function agentOutput(run: EstimateRun, agentKey: string): Record<string, unknown> {
		return ((run.agent_outputs as Record<string, Record<string, unknown>>)?.[agentKey]) ?? {};
	}

</script>

<div class="comparison">
	<div class="comp-header">
		<div class="comp-title">Comparação de Runs</div>
		<button class="btn-close" onclick={onclose} type="button" aria-label="Fechar">✕</button>
	</div>

	{#if loading}
		<div class="state-msg">Carregando comparação…</div>
	{:else if loadErr}
		<div class="state-msg state-err">{loadErr}</div>
	{:else if result}
		<!-- Summary bar -->
		<div class="summary-bar">
			<div class="summary-item">
				<span class="summary-label">Agentes com diferenças</span>
				<strong class:highlight={result.summary.changed_agents > 0}>
					{result.summary.changed_agents} / {result.summary.total_agents}
				</strong>
			</div>
			<div class="summary-item">
				<span class="summary-label">Duração A</span>
				<strong>{result.summary.duration_a?.toFixed(1) ?? '—'}s</strong>
			</div>
			<div class="summary-item">
				<span class="summary-label">Duração B</span>
				<strong>{result.summary.duration_b?.toFixed(1) ?? '—'}s</strong>
			</div>
			{#if result.summary.duration_delta != null}
				<div class="summary-item">
					<span class="summary-label">Delta duração</span>
					<strong class="{deltaClass(result.summary.duration_delta)}">
						{fmtDelta(result.summary.duration_delta)}
					</strong>
				</div>
			{/if}
		</div>

		<!-- Run headers -->
		<div class="runs-header">
			<div class="run-col run-a">
				<span class="run-tag tag-a">A</span>
				<span class="run-meta">{result.run_a.llm_model ?? '—'} · {result.run_a.total_duration_s?.toFixed(1) ?? '—'}s</span>
			</div>
			<div class="run-col run-b">
				<span class="run-tag tag-b">B</span>
				<span class="run-meta">{result.run_b.llm_model ?? '—'} · {result.run_b.total_duration_s?.toFixed(1) ?? '—'}s</span>
			</div>
		</div>

		<!-- Per-agent diff rows -->
		<div class="agents">
			{#each Object.entries(result.diffs) as [agentKey, diff] (agentKey)}
				{@const dur = result.step_durations[agentKey]}
				{@const label = AGENT_LABELS[agentKey] ?? agentKey}
				{@const isExpanded = expandedAgent === agentKey}
				<div class="agent-block" class:changed={diff.changed}>
					<button
						class="agent-row"
						onclick={() => expandedAgent = isExpanded ? null : agentKey}
						type="button"
					>
						<span class="change-dot" class:dot-changed={diff.changed} class:dot-same={!diff.changed}></span>
						<span class="agent-name">{label}</span>
						{#if diff.changed}
							<span class="changed-fields">{diff.fields.length} campo(s) alterado(s)</span>
						{:else}
							<span class="unchanged">Sem alterações</span>
						{/if}
						<div class="dur-deltas">
							{#if dur}
								<span class="dur-a">{dur.a?.toFixed(1) ?? '—'}s</span>
								<span class="dur-arrow">→</span>
								<span class="dur-b">{dur.b?.toFixed(1) ?? '—'}s</span>
								{#if dur.delta != null}
									<span class="dur-delta {deltaClass(dur.delta)}">{fmtDelta(dur.delta)}</span>
								{/if}
							{/if}
						</div>
						<span class="expand-icon">{isExpanded ? '▲' : '▼'}</span>
					</button>

					{#if isExpanded}
						<div class="diff-panels">
							<div class="diff-panel">
								<div class="diff-panel-label tag-a">Run A</div>
								<AgentStepCard {agentKey} output={agentOutput(result.run_a, agentKey)} />
							</div>
							<div class="diff-panel">
								<div class="diff-panel-label tag-b">Run B</div>
								<AgentStepCard {agentKey} output={agentOutput(result.run_b, agentKey)} />
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Cost delta summary -->
		{#if Object.keys(result.cost_delta).length > 0}
			<div class="cost-section">
				<div class="cost-title">Variação de Custo por Cenário</div>
				<div class="cost-rows">
					{#each Object.entries(result.cost_delta) as [name, cd] (name)}
						<div class="cost-row">
							<span class="cost-name">{name}</span>
							<span class="cost-a">{cd.a != null ? `$${cd.a.toLocaleString('pt-BR')}` : '—'}</span>
							<span class="cost-arrow">→</span>
							<span class="cost-b">{cd.b != null ? `$${cd.b.toLocaleString('pt-BR')}` : '—'}</span>
							{#if cd.delta_pct != null}
								<span class="cost-delta {cd.delta_pct > 0 ? 'delta-worse' : cd.delta_pct < 0 ? 'delta-better' : ''}">
									{cd.delta_pct > 0 ? '+' : ''}{cd.delta_pct}%
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.comparison {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.25rem 1.5rem;
		margin-top: 1rem;
	}

	.comp-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.comp-title {
		font-size: 0.875rem;
		font-weight: 700;
		color: #f3f4f6;
	}

	.btn-close {
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0.25rem;
	}

	.btn-close:hover { color: #e5e7eb; }

	.state-msg {
		text-align: center;
		font-size: 0.875rem;
		color: #6b7280;
		padding: 1.5rem 0;
	}

	.state-err { color: #fca5a5; }

	/* Summary bar */
	.summary-bar {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.summary-label {
		font-size: 0.7rem;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.summary-item strong {
		font-size: 0.9rem;
		color: #e5e7eb;
	}

	.summary-item strong.highlight { color: #fcd34d; }

	/* Run headers */
	.runs-header {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.run-col {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.75rem;
		border-radius: 6px;
	}

	.run-a { background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); }
	.run-b { background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); }

	.run-tag {
		font-size: 0.7rem;
		font-weight: 700;
		width: 18px;
		height: 18px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tag-a { background: rgba(99, 102, 241, 0.3); color: var(--color-primary-400, #818cf8); }
	.tag-b { background: rgba(245, 158, 11, 0.3); color: #fcd34d; }

	.run-meta {
		font-size: 0.775rem;
		color: #9ca3af;
	}

	/* Agents */
	.agents {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-bottom: 1rem;
	}

	.agent-block {
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 7px;
		overflow: hidden;
	}

	.agent-block.changed { border-color: rgba(245, 158, 11, 0.2); }

	.agent-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: rgba(255, 255, 255, 0.02);
		border: none;
		text-align: left;
		cursor: pointer;
		color: inherit;
		font-size: 0.8125rem;
	}

	.agent-row:hover { background: rgba(255, 255, 255, 0.04); }

	.change-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot-changed { background: #f59e0b; }
	.dot-same    { background: rgba(255, 255, 255, 0.15); }

	.agent-name {
		font-weight: 600;
		color: #e5e7eb;
		flex: 1;
	}

	.changed-fields { font-size: 0.75rem; color: #f59e0b; }
	.unchanged      { font-size: 0.75rem; color: #6b7280; }

	.dur-deltas {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: #6b7280;
		font-family: monospace;
	}

	.dur-a, .dur-b { color: #9ca3af; }
	.dur-arrow { color: #4b5563; }

	.dur-delta, .cost-delta {
		font-weight: 600;
	}

	.delta-better { color: var(--color-success, #10b981); }
	.delta-worse  { color: #f59e0b; }

	.expand-icon {
		font-size: 0.6rem;
		color: #4b5563;
		flex-shrink: 0;
	}

	/* Diff panels */
	.diff-panels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.diff-panel {
		padding: 0.75rem;
	}

	.diff-panel:first-child {
		border-right: 1px solid rgba(255, 255, 255, 0.05);
	}

	.diff-panel-label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.1rem 0.45rem;
		border-radius: 4px;
		margin-bottom: 0.5rem;
	}

	/* Cost section */
	.cost-section {
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.02);
		border-radius: 7px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.cost-title {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7280;
		margin-bottom: 0.5rem;
	}

	.cost-rows {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.cost-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}

	.cost-name {
		min-width: 100px;
		color: #9ca3af;
		text-transform: capitalize;
	}

	.cost-a, .cost-b { color: #e5e7eb; font-family: monospace; }
	.cost-arrow { color: #4b5563; }
</style>
