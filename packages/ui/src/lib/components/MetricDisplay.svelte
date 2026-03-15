<script lang="ts">
	interface Props {
		label: string;
		value: string | number;
		unit?: string;
		variant?: 'default' | 'highlight';
	}

	let { label, value, unit, variant = 'default' }: Props = $props();
</script>

<div class="metric metric-{variant}">
	<span class="metric-label">{label}</span>
	<div class="metric-value-row">
		<span class="metric-value">{value}</span>
		{#if unit}
			<span class="metric-unit">{unit}</span>
		{/if}
	</div>
</div>

<style>
	.metric {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		background-color: var(--color-dark-surface, #1a1d27);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.metric-highlight {
		border-color: var(--color-primary-500, #6366f1);
		background-color: color-mix(in srgb, var(--color-primary-500, #6366f1) 8%, var(--color-dark-surface, #1a1d27));
	}

	.metric-label {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.metric-value-row {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.metric-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
	}

	.metric-unit {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.5);
	}
</style>
