<script lang="ts">
	import type { KnowledgeVector } from '$lib/server/admin-cockpit';
	import { fmtDate } from '$lib/utils/admin';

	let { vectors }: { vectors: KnowledgeVector[] } = $props();
</script>

<div class="tab-content">
	<div class="section-title">Vetores ({vectors.length})</div>
	{#if vectors.length === 0}
		<div class="empty-tab">
			<div class="empty-icon">∅</div>
			<div>Nenhum vetor gerado ainda.</div>
			<div class="muted" style="font-size:0.8rem;margin-top:0.25rem">
				Vetores são criados após a estimativa ser concluída com sucesso.
			</div>
		</div>
	{:else}
		<div class="vectors-list">
			{#each vectors as v (v.id)}
				<div class="vector-row">
					<div class="vector-meta">
						<span class="mime-badge">{v.source_type}</span>
						<span class="muted">{fmtDate(v.created_at)}</span>
					</div>
					<div class="vector-content">{v.content.slice(0, 200)}{v.content.length > 200 ? '…' : ''}</div>
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

	.empty-icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
		opacity: 0.4;
	}

	.vectors-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.vector-row {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		padding: 0.6rem 0.75rem;
	}

	.vector-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.3rem;
	}

	.vector-content {
		font-size: 0.8rem;
		color: #9ca3af;
		line-height: 1.5;
	}

	.mime-badge {
		background: rgba(99, 102, 241, 0.15);
		color: var(--color-primary-500, #6366f1);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}
</style>
