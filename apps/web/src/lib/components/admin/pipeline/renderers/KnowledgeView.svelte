<script lang="ts">
	let { data }: { data: Record<string, unknown> } = $props();

	const embeddingText = $derived(
		(data?.embedding_text ?? data?.text ?? data?.content ?? null) as string | null
	);
	const metadata = $derived(
		(data?.metadata ?? data?.tags ?? null) as Record<string, unknown> | null
	);
	const summary = $derived((data?.summary ?? null) as string | null);

	const hasData = $derived(!!embeddingText || !!metadata || !!summary);

	function metaValue(v: unknown): string {
		if (Array.isArray(v)) return v.join(', ');
		return String(v);
	}
</script>

{#if !hasData}
	<pre class="fallback">{JSON.stringify(data, null, 2)}</pre>
{:else}
	{#if summary}
		<p class="summary">{summary}</p>
	{/if}

	{#if metadata}
		<div class="section">
			<div class="section-label">Metadata Tags</div>
			<div class="meta-grid">
				{#each Object.entries(metadata) as [k, v] (k)}
					<div class="meta-item">
						<span class="meta-key">{k.replace(/_/g, ' ')}</span>
						<span class="meta-val">{metaValue(v)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if embeddingText}
		<div class="section">
			<div class="section-label">Texto para Embedding</div>
			<div class="embed-preview">
				<pre class="embed-text">{embeddingText}</pre>
				<div class="embed-stats">
					<span>{embeddingText.length} chars</span>
					<span>~{Math.round(embeddingText.split(/\s+/).length)} tokens</span>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	.summary {
		font-size: 0.8125rem;
		color: #d1d5db;
		line-height: 1.6;
		margin-bottom: 1rem;
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 6px;
	}

	.section {
		margin-bottom: 1rem;
	}

	.section-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.4rem;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.5rem;
	}

	.meta-item {
		padding: 0.5rem 0.625rem;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.meta-key {
		display: block;
		font-size: 0.65rem;
		color: #6b7280;
		text-transform: capitalize;
		margin-bottom: 0.15rem;
	}

	.meta-val {
		font-size: 0.8125rem;
		color: #e5e7eb;
		font-weight: 500;
	}

	.embed-preview {
		background: var(--color-dark-bg, #0f1117);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		overflow: hidden;
	}

	.embed-text {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.75rem;
		color: #d1d5db;
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
		padding: 0.75rem;
		max-height: 300px;
		overflow-y: auto;
		line-height: 1.5;
	}

	.embed-stats {
		display: flex;
		gap: 1rem;
		padding: 0.375rem 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		font-size: 0.7rem;
		color: #6b7280;
	}

	.fallback {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.75rem;
		color: #d1d5db;
		white-space: pre-wrap;
		word-break: break-all;
		margin: 0;
	}
</style>
