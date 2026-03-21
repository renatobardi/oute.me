<script lang="ts">
	interface Props {
		filename: string;
		status: 'pending' | 'processing' | 'completed' | 'failed';
		mimeType: string;
		ondelete?: () => void;
	}

	let { filename, status, mimeType, ondelete }: Props = $props();

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
	{#if ondelete}
		<button class="doc-delete" onclick={ondelete} title="Remover documento" aria-label="Remover {filename}">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>
	{/if}
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
		flex-shrink: 0;
	}

	.doc-delete {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--color-neutral-500, #6b7280);
		cursor: pointer;
		padding: 0;
		margin-left: auto;
		transition: color 0.15s, background 0.15s;
	}

	.doc-delete:hover {
		color: var(--color-error, #ef4444);
		background: rgba(239, 68, 68, 0.1);
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
