<script lang="ts">
	import type { FunnelStep } from '$lib/server/admin-dashboard';

	let {
		steps,
		period,
		onperiodchange,
	}: {
		steps: FunnelStep[];
		period: number;
		onperiodchange: (p: number) => void;
	} = $props();

	const maxCount = $derived(Math.max(...steps.map((s) => s.count), 1));
</script>

<div class="funnel-card">
	<div class="funnel-header">
		<div class="section-title">Funil de Conversão</div>
		<div class="period-tabs">
			{#each [7, 30, 90] as p (p)}
				<button
					class="period-tab"
					class:active={period === p}
					onclick={() => onperiodchange(p)}
				>{p}d</button>
			{/each}
		</div>
	</div>

	<div class="funnel-steps">
		{#each steps as step (step.label)}
			<div class="funnel-row">
				<div class="funnel-label">{step.label}</div>
				<div class="funnel-bar-wrap">
					<div
						class="funnel-bar"
						style="width:{maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0}%"
					></div>
				</div>
				<div class="funnel-count">{step.count}</div>
				{#if step.rate !== null}
					<div class="funnel-rate" class:rate-low={step.rate < 0.3}>
						{Math.round(step.rate * 100)}%
					</div>
				{:else}
					<div class="funnel-rate-empty"></div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.funnel-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.25rem 1.5rem;
	}

	.funnel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.period-tabs {
		display: flex;
		gap: 0.25rem;
	}

	.period-tab {
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.period-tab.active {
		background: rgba(99, 102, 241, 0.15);
		border-color: var(--color-primary-500, #6366f1);
		color: var(--color-primary-400, #818cf8);
	}

	.funnel-steps {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.funnel-row {
		display: grid;
		grid-template-columns: 130px 1fr 50px 44px;
		align-items: center;
		gap: 0.75rem;
	}

	.funnel-label {
		font-size: 0.8125rem;
		color: #d1d5db;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.funnel-bar-wrap {
		height: 8px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 4px;
		overflow: hidden;
	}

	.funnel-bar {
		height: 100%;
		background: var(--color-primary-500, #6366f1);
		border-radius: 4px;
		transition: width 0.4s ease;
	}

	.funnel-count {
		font-size: 0.875rem;
		font-weight: 600;
		color: #f9fafb;
		text-align: right;
	}

	.funnel-rate {
		font-size: 0.75rem;
		color: var(--color-success, #10b981);
		text-align: right;
	}

	.funnel-rate.rate-low {
		color: var(--color-warning, #f59e0b);
	}

	.funnel-rate-empty {
		width: 44px;
	}
</style>
