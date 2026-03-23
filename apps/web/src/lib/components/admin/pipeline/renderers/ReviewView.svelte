<script lang="ts">
	let { data }: { data: Record<string, unknown> } = $props();

	type CheckItem = { item?: string; label?: string; description?: string; passed?: boolean; status?: string };

	const checklist = $derived(
		(data?.validation_checklist ?? data?.checklist ?? data?.validation_items ?? []) as CheckItem[]
	);
	const issues = $derived((data?.issues ?? data?.warnings ?? []) as string[]);
	const executiveSummary = $derived(
		(data?.executive_summary ?? data?.summary ?? null) as string | null
	);

	function isPassed(item: CheckItem) {
		if (item.passed != null) return item.passed;
		if (item.status != null) return item.status === 'pass' || item.status === 'ok' || item.status === 'true';
		return null;
	}

	function itemLabel(item: CheckItem) {
		return item.label ?? item.item ?? item.description ?? JSON.stringify(item);
	}

	const hasData = $derived(checklist.length > 0 || issues.length > 0 || !!executiveSummary);
</script>

{#if !hasData}
	<pre class="fallback">{JSON.stringify(data, null, 2)}</pre>
{:else}
	{#if executiveSummary}
		<div class="callout">
			<div class="callout-label">Executive Summary</div>
			<p class="callout-text">{executiveSummary}</p>
		</div>
	{/if}

	{#if checklist.length > 0}
		<div class="section">
			<div class="section-label">Checklist de Validação</div>
			<ul class="checklist">
				{#each checklist as item, ci (ci)}
					{@const passed = isPassed(item)}
					<li class="check-item">
						<span class="check-icon" class:passed={passed === true} class:failed={passed === false}>
							{#if passed === true}✓{:else if passed === false}✗{:else}—{/if}
						</span>
						<span class="check-label">{itemLabel(item)}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if issues.length > 0}
		<div class="section">
			<div class="section-label">Issues Encontradas</div>
			<ul class="issues-list">
				{#each issues as issue, ii (ii)}
					<li class="issue-item">{issue}</li>
				{/each}
			</ul>
		</div>
	{/if}
{/if}

<style>
	.callout {
		padding: 0.75rem 0.875rem;
		background: rgba(99, 102, 241, 0.08);
		border: 1px solid rgba(99, 102, 241, 0.2);
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.callout-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-primary-400, #818cf8);
		margin-bottom: 0.375rem;
	}

	.callout-text {
		font-size: 0.8125rem;
		color: #d1d5db;
		line-height: 1.6;
		margin: 0;
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

	.checklist {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.check-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.02);
		font-size: 0.8125rem;
		color: #e5e7eb;
	}

	.check-icon {
		font-size: 0.875rem;
		font-weight: 700;
		width: 18px;
		flex-shrink: 0;
		color: #6b7280;
	}

	.check-icon.passed { color: var(--color-success, #10b981); }
	.check-icon.failed { color: var(--color-error, #ef4444); }

	.check-label {
		line-height: 1.4;
	}

	.issues-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.issue-item {
		padding: 0.375rem 0.625rem;
		font-size: 0.8125rem;
		color: #fca5a5;
		background: rgba(239, 68, 68, 0.08);
		border-left: 3px solid rgba(239, 68, 68, 0.4);
		border-radius: 0 5px 5px 0;
		line-height: 1.4;
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
