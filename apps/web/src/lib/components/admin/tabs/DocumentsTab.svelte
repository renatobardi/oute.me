<script lang="ts">
	import type { InterviewDocument } from '$lib/types/interview';
	import { fmtDate, mimeLabel } from '$lib/utils/admin';

	let {
		documents,
		download,
	}: {
		documents: InterviewDocument[];
		download: (docId: string) => Promise<void>;
	} = $props();
</script>

<div class="tab-content">
	<div class="section-title">Documentos ({documents.length})</div>
	{#if documents.length === 0}
		<div class="empty-tab">Nenhum documento enviado nesta entrevista.</div>
	{:else}
		<div class="docs-list">
			{#each documents as doc (doc.id)}
				<div class="doc-row">
					<div class="doc-info">
						<span class="doc-name">{doc.filename}</span>
						<span class="doc-meta">
							<span class="mime-badge">{mimeLabel(doc.mime_type)}</span>
							<span class="muted">{fmtDate(doc.created_at)}</span>
							<span
								class="status-dot"
								class:dot-ok={doc.status === 'completed'}
								class:dot-fail={doc.status === 'failed'}
								class:dot-pending={doc.status === 'pending'}
							>{doc.status}</span>
						</span>
					</div>
					<button class="download-btn" onclick={() => download(doc.id)}>
						↓ Download
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.tab-content {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 1rem 1.125rem;
		margin-top: 0.5rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.75rem;
	}

	.empty-tab {
		text-align: center;
		padding: 2rem 1rem;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
	}

	.docs-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.doc-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		padding: 0.6rem 0.75rem;
	}

	.doc-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.doc-name {
		font-size: 0.875rem;
		color: #f9fafb;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.doc-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
	}

	.mime-badge {
		background: rgba(99, 102, 241, 0.15);
		color: var(--color-primary-500, #6366f1);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.status-dot {
		font-size: 0.7rem;
	}

	.dot-ok { color: var(--color-success, #10b981); }
	.dot-fail { color: var(--color-error, #ef4444); }
	.dot-pending { color: var(--color-warning, #f59e0b); }

	.download-btn {
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 6px;
		color: var(--color-primary-500, #6366f1);
		font-size: 0.8rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.download-btn:hover {
		background: rgba(99, 102, 241, 0.22);
	}

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}
</style>
