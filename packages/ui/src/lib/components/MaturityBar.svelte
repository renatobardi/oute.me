<script lang="ts">
	interface DomainDisplay {
		answered: number;
		total: number;
		vital_answered: boolean;
	}

	interface Props {
		maturity: number;
		domains: Record<string, DomainDisplay>;
		threshold?: number;
	}

	let { maturity, domains, threshold = 0.7 }: Props = $props();

	const percentage = $derived(Math.round(maturity * 100));
	const isReady = $derived(maturity >= threshold);

	const domainLabels: Record<string, string> = {
		scope: 'Escopo',
		timeline: 'Timeline',
		budget: 'Budget',
		integrations: 'Integrações',
		tech_stack: 'Tech Stack',
	};
</script>

<div class="maturity">
	<div class="maturity-header">
		<span class="maturity-label">Maturidade</span>
		<span class="maturity-value" class:ready={isReady}>{percentage}%</span>
	</div>

	<div class="maturity-track">
		<div
			class="maturity-fill"
			class:ready={isReady}
			style="width: {percentage}%"
		></div>
		<div class="maturity-threshold" style="left: {threshold * 100}%"></div>
	</div>

	<div class="domains">
		{#each Object.entries(domains) as [key, domain] (key)}
			{@const progress = domain.total > 0 ? Math.round((domain.answered / domain.total) * 100) : 0}
			<div class="domain">
				<div class="domain-header">
					<span class="domain-name">{domainLabels[key] || key}</span>
					{#if domain.vital_answered}
						<span class="vital-check">✓</span>
					{/if}
				</div>
				<div class="domain-track">
					<div class="domain-fill" style="width: {progress}%"></div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.maturity {
		padding: 1rem;
		background: var(--color-dark-surface, #1a1d27);
		border-radius: 12px;
	}

	.maturity-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.maturity-label {
		font-size: 0.875rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.maturity-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-warning, #f59e0b);
	}

	.maturity-value.ready {
		color: var(--color-success, #10b981);
	}

	.maturity-track {
		position: relative;
		height: 8px;
		background: var(--color-neutral-700, #374151);
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.maturity-fill {
		height: 100%;
		border-radius: 4px;
		background: var(--color-warning, #f59e0b);
		transition: width 0.5s ease;
	}

	.maturity-fill.ready {
		background: var(--color-success, #10b981);
	}

	.maturity-threshold {
		position: absolute;
		top: -4px;
		width: 2px;
		height: 16px;
		background: var(--color-neutral-300, #d1d5db);
		opacity: 0.5;
	}

	.domains {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.domain-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.domain-name {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.vital-check {
		font-size: 0.75rem;
		color: var(--color-success, #10b981);
	}

	.domain-track {
		height: 4px;
		background: var(--color-neutral-700, #374151);
		border-radius: 2px;
	}

	.domain-fill {
		height: 100%;
		border-radius: 2px;
		background: var(--color-primary-500, #6366f1);
		transition: width 0.5s ease;
	}
</style>
