<script lang="ts">
	import type { EstimateRun } from '$lib/types/estimate';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { fmtDate } from '$lib/utils/admin';

	let { runs }: { runs: EstimateRun[] } = $props();
</script>

{#if runs.length > 0}
	<div class="section-title" style="margin-top:1.5rem">Histórico de Runs</div>
	<div class="runs-list">
		{#each runs as run (run.id)}
			<div class="run-row">
				<StatusBadge status={run.status} />
				<span class="muted">{run.llm_model ?? '—'}</span>
				{#if run.total_duration_s}
					<span class="muted">{run.total_duration_s.toFixed(1)}s</span>
				{/if}
				<span class="muted">{fmtDate(run.created_at)}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.6rem;
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
	}

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}
</style>
