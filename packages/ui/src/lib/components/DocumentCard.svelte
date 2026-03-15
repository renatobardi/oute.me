<script lang="ts">
	interface Props {
		filename: string;
		status: 'pending' | 'processing' | 'completed' | 'failed';
		mimeType: string;
	}

	let { filename, status, mimeType }: Props = $props();

	const icon = $derived(() => {
		if (mimeType.startsWith('image/')) return '🖼';
		if (mimeType.includes('pdf')) return '📄';
		if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
			return '📊';
		if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑';
		return '📎';
	});

	const statusLabel: Record<string, string> = {
		pending: 'Aguardando',
		processing: 'Processando...',
		completed: 'Processado',
		failed: 'Erro',
	};
</script>

<div class="doc-card">
	<span class="doc-icon">{icon()}</span>
	<div class="doc-info">
		<span class="doc-name">{filename}</span>
		<span class="doc-status status-{status}">{statusLabel[status]}</span>
	</div>
</div>

<style>
	.doc-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.875rem;
		background: var(--color-dark-surface, #1a1d27);
		border-radius: 8px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	.doc-icon {
		font-size: 1.25rem;
	}

	.doc-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.doc-name {
		font-size: 0.875rem;
		color: var(--color-neutral-300, #d1d5db);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.doc-status {
		font-size: 0.75rem;
	}

	.status-pending {
		color: var(--color-neutral-500, #6b7280);
	}
	.status-processing {
		color: var(--color-warning, #f59e0b);
	}
	.status-completed {
		color: var(--color-success, #10b981);
	}
	.status-failed {
		color: var(--color-error, #ef4444);
	}
</style>
