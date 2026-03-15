<script lang="ts">
	interface Props {
		value: number;
		max?: number;
		label?: string;
		showPercentage?: boolean;
		variant?: 'primary' | 'success' | 'warning' | 'error';
	}

	let { value, max = 100, label, showPercentage = true, variant = 'primary' }: Props = $props();

	let percentage = $derived(Math.min(Math.round((value / max) * 100), 100));

	const variantColors: Record<string, string> = {
		primary: 'var(--color-primary-500, #6366f1)',
		success: 'var(--color-success, #10b981)',
		warning: 'var(--color-warning, #f59e0b)',
		error: 'var(--color-error, #ef4444)',
	};

	let barColor = $derived(variantColors[variant] || variantColors.primary);
</script>

<div class="progress-container">
	{#if label || showPercentage}
		<div class="progress-header">
			{#if label}
				<span class="progress-label">{label}</span>
			{/if}
			{#if showPercentage}
				<span class="progress-value">{percentage}%</span>
			{/if}
		</div>
	{/if}
	<div class="progress-track">
		<div
			class="progress-fill"
			style="width: {percentage}%; background-color: {barColor}"
			role="progressbar"
			aria-valuenow={value}
			aria-valuemin={0}
			aria-valuemax={max}
		></div>
	</div>
</div>

<style>
	.progress-container {
		width: 100%;
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.375rem;
	}

	.progress-label {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.progress-value {
		font-size: 0.875rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.9);
	}

	.progress-track {
		width: 100%;
		height: 8px;
		background-color: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.5s ease;
	}
</style>
