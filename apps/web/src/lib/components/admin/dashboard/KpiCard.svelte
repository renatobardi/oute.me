<script lang="ts">
	let {
		label,
		value,
		sub,
		color = 'default',
	}: {
		label: string;
		value: string | number;
		sub?: string;
		color?: 'default' | 'success' | 'warning' | 'error';
	} = $props();
</script>

<div class="card card-{color}">
	<div class="card-label">{label}</div>
	<div class="card-value">{value}</div>
	{#if sub}
		<div class="card-sub">{sub}</div>
	{/if}
</div>

<style>
	.card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.card-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-neutral-500, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.card-value {
		font-size: 2rem;
		font-weight: 700;
		color: #f9fafb;
		line-height: 1.1;
	}

	.card-sub {
		font-size: 0.8125rem;
		color: var(--color-neutral-500, #6b7280);
		margin-top: 0.1rem;
	}

	.card-success .card-value { color: var(--color-success, #10b981); }
	.card-warning .card-value { color: var(--color-warning, #f59e0b); }
	.card-error   .card-value { color: var(--color-error, #ef4444); }
</style>
