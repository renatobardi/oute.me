<script lang="ts">
	import type { CostScenario } from '$lib/types/estimate';

	let { data }: { data: Record<string, unknown> } = $props();

	const scenarios = $derived(
		(data?.cost_scenarios ?? data?.scenarios ?? []) as CostScenario[]
	);

	const maxCost = $derived(
		scenarios.length > 0 ? Math.max(...scenarios.map((s) => s.total_cost ?? 0)) : 1
	);

	function fmt(n: number, currency = 'USD') {
		return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
	}

	const scenarioColor: Record<string, string> = {
		conservador: 'rgba(16, 185, 129, 0.15)',
		moderado: 'rgba(99, 102, 241, 0.15)',
		otimista: 'rgba(245, 158, 11, 0.15)',
	};
	const scenarioBorder: Record<string, string> = {
		conservador: 'rgba(16, 185, 129, 0.3)',
		moderado: 'rgba(99, 102, 241, 0.5)',
		otimista: 'rgba(245, 158, 11, 0.3)',
	};
	const scenarioTextColor: Record<string, string> = {
		conservador: '#6ee7b7',
		moderado: '#818cf8',
		otimista: '#fcd34d',
	};

	const hasData = $derived(scenarios.length > 0);
</script>

{#if !hasData}
	<pre class="fallback">{JSON.stringify(data, null, 2)}</pre>
{:else}
	<!-- Side-by-side cards -->
	<div class="scenarios">
		{#each scenarios as sc (sc.name)}
			{@const isModerado = sc.name === 'moderado'}
			<div
				class="sc-card"
				class:sc-highlight={isModerado}
				style="background: {scenarioColor[sc.name] ?? 'rgba(255,255,255,0.04)'}; border-color: {scenarioBorder[sc.name] ?? 'rgba(255,255,255,0.1)'};"
			>
				{#if isModerado}
					<div class="sc-badge-top">Recomendado</div>
				{/if}
				<div class="sc-name" style="color: {scenarioTextColor[sc.name] ?? '#9ca3af'};">
					{sc.name.charAt(0).toUpperCase() + sc.name.slice(1)}
				</div>
				<div class="sc-cost">{fmt(sc.total_cost, sc.currency)}</div>
				<div class="sc-meta">
					<div class="sc-row"><span>Horas</span><strong>{sc.total_hours}h</strong></div>
					<div class="sc-row"><span>Duração</span><strong>{sc.duration_weeks}s sem.</strong></div>
					<div class="sc-row"><span>Time</span><strong>{sc.team_size} devs</strong></div>
					<div class="sc-row"><span>Confiança</span><strong>{Math.round((sc.confidence ?? 0) * 100)}%</strong></div>
					{#if sc.risk_buffer_percent}
						<div class="sc-row"><span>Buffer risco</span><strong>{sc.risk_buffer_percent}%</strong></div>
					{/if}
				</div>
				<!-- mini bar -->
				<div class="bar-track">
					<div
						class="bar-fill"
						style="width: {Math.round((sc.total_cost / maxCost) * 100)}%; background: {scenarioTextColor[sc.name] ?? '#818cf8'};"
					></div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.scenarios {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}

	@media (max-width: 700px) {
		.scenarios { grid-template-columns: 1fr; }
	}

	.sc-card {
		position: relative;
		padding: 0.875rem;
		border: 1px solid transparent;
		border-radius: 8px;
	}

	.sc-highlight {
		box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.4);
	}

	.sc-badge-top {
		position: absolute;
		top: -10px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		background: var(--color-primary-600, #4f46e5);
		color: #fff;
		padding: 0.15rem 0.6rem;
		border-radius: 9999px;
		white-space: nowrap;
	}

	.sc-name {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.375rem;
	}

	.sc-cost {
		font-size: 1.375rem;
		font-weight: 700;
		color: #f9fafb;
		margin-bottom: 0.75rem;
	}

	.sc-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.625rem;
	}

	.sc-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.775rem;
	}

	.sc-row span { color: #9ca3af; }
	.sc-row strong { color: #e5e7eb; }

	.bar-track {
		height: 3px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 9999px;
		opacity: 0.6;
	}

	.fallback {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.75rem;
		color: #d1d5db;
		white-space: pre-wrap;
		word-break: break-all;
		margin: 0;
	}
</style>
