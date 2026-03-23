<script lang="ts">
	import type { EstimateRun } from '$lib/types/estimate';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { fmtDate } from '$lib/utils/admin';

	let {
		runs,
		oncompare,
	}: {
		runs: EstimateRun[];
		oncompare?: (runA: string, runB: string) => void;
	} = $props();

	let selectedA = $state<string | null>(null);
	let selectedB = $state<string | null>(null);

	function toggleSelect(runId: string) {
		if (selectedA === runId) {
			selectedA = null;
		} else if (selectedB === runId) {
			selectedB = null;
		} else if (!selectedA) {
			selectedA = runId;
		} else if (!selectedB) {
			selectedB = runId;
		} else {
			// replace oldest selection
			selectedA = selectedB;
			selectedB = runId;
		}
	}

	const canCompare = $derived(!!selectedA && !!selectedB && selectedA !== selectedB);

	function handleCompare() {
		if (canCompare) oncompare?.(selectedA!, selectedB!);
	}
</script>

{#if runs.length > 0}
	<div class="history-header">
		<div class="section-title">Histórico de Runs</div>
		{#if oncompare && runs.length >= 2}
			<div class="compare-hint">
				{#if canCompare}
					<button class="btn-compare" onclick={handleCompare}>
						Comparar selecionadas
					</button>
				{:else}
					<span class="hint-text">Selecione 2 runs para comparar</span>
				{/if}
			</div>
		{/if}
	</div>
	<div class="runs-list">
		{#each runs as run (run.id)}
			{@const isSelectedA = selectedA === run.id}
			{@const isSelectedB = selectedB === run.id}
			{@const isSelected = isSelectedA || isSelectedB}
			<button
				class="run-row"
				class:selected={isSelected}
				class:selected-a={isSelectedA}
				class:selected-b={isSelectedB}
				onclick={() => toggleSelect(run.id)}
				type="button"
			>
				{#if isSelectedA}
					<span class="sel-tag sel-a">A</span>
				{:else if isSelectedB}
					<span class="sel-tag sel-b">B</span>
				{:else}
					<span class="sel-tag sel-empty"></span>
				{/if}
				<StatusBadge status={run.status} />
				<span class="muted">{run.llm_model ?? '—'}</span>
				{#if run.total_duration_s}
					<span class="muted">{run.total_duration_s.toFixed(1)}s</span>
				{/if}
				<span class="muted">{fmtDate(run.created_at)}</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1.5rem;
		margin-bottom: 0.6rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.compare-hint {
		display: flex;
		align-items: center;
	}

	.hint-text {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.btn-compare {
		padding: 0.25rem 0.75rem;
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 6px;
		color: var(--color-primary-400, #818cf8);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-compare:hover {
		background: rgba(99, 102, 241, 0.25);
	}

	.runs-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.run-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.6rem;
		background: rgba(255, 255, 255, 0.02);
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		border: 1px solid transparent;
		text-align: left;
		width: 100%;
		transition: background 0.15s, border-color 0.15s;
	}

	.run-row:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.run-row.selected-a { border-color: rgba(99, 102, 241, 0.5); background: rgba(99, 102, 241, 0.06); }
	.run-row.selected-b { border-color: rgba(245, 158, 11, 0.5); background: rgba(245, 158, 11, 0.06); }

	.sel-tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 4px;
		font-size: 0.625rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.sel-empty { background: transparent; }
	.sel-a { background: rgba(99, 102, 241, 0.25); color: var(--color-primary-400, #818cf8); }
	.sel-b { background: rgba(245, 158, 11, 0.25); color: #fcd34d; }

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}
</style>
