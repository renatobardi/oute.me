<script lang="ts">
	interface Props {
		status: string;
		size?: 'sm' | 'md';
	}

	let { status, size = 'md' }: Props = $props();

	const statusColors: Record<string, string> = {
		pending: 'var(--color-warning, #f59e0b)',
		running: 'var(--color-primary-500, #6366f1)',
		done: 'var(--color-success, #10b981)',
		failed: 'var(--color-error, #ef4444)',
		approved: 'var(--color-success, #10b981)',
		active: 'var(--color-success, #10b981)',
		completed: 'var(--color-success, #10b981)',
	};

	const statusLabels: Record<string, string> = {
		pending: 'Pendente',
		running: 'Processando',
		done: 'Concluído',
		failed: 'Falhou',
		approved: 'Aprovado',
		active: 'Ativo',
		completed: 'Concluído',
	};

	let color = $derived(statusColors[status] || 'var(--color-warning, #f59e0b)');
	let label = $derived(statusLabels[status] || status);
</script>

<span class="badge badge-{size}" style="--badge-color: {color}">
	<span class="dot"></span>
	{label}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border-radius: 9999px;
		font-weight: 500;
		color: var(--badge-color);
		background-color: color-mix(in srgb, var(--badge-color) 15%, transparent);
	}

	.badge-sm {
		padding: 0.125rem 0.5rem;
		font-size: 0.75rem;
	}

	.badge-md {
		padding: 0.25rem 0.75rem;
		font-size: 0.875rem;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--badge-color);
	}

	.badge:has(.dot) .dot {
		animation: none;
	}

	:global(.badge[style*="--badge-color: var(--color-primary-500"]) .dot {
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
</style>
