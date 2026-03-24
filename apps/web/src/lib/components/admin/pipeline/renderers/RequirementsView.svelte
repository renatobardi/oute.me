<script lang="ts">
	let { data }: { data: Record<string, unknown> } = $props();

	type Requirement = { description?: string; requirement?: string; complexity?: string };

	const functional = $derived(
		(data?.functional_requirements ?? data?.functional ?? []) as Requirement[]
	);
	const nonFunctional = $derived(
		(data?.non_functional_requirements ?? data?.non_functional ?? []) as Requirement[]
	);
	const integrations = $derived(
		(data?.integration_requirements ?? data?.integrations ?? []) as Requirement[]
	);
	const constraints = $derived(
		(data?.technical_constraints ?? data?.constraints ?? []) as Requirement[]
	);
	const summary = $derived(data?.consolidated_requirements ?? data?.summary ?? null);

	const COMPLEXITY_CLASS: Record<string, string> = {
		high: 'badge-high',
		alta: 'badge-high',
		'3': 'badge-high',
		medium: 'badge-medium',
		media: 'badge-medium',
		média: 'badge-medium',
		'2': 'badge-medium',
		low: 'badge-low',
		baixa: 'badge-low',
		'1': 'badge-low',
	};

	function complexityClass(c?: string): string {
		if (!c) return 'badge-neutral';
		return COMPLEXITY_CLASS[c.toLowerCase()] ?? 'badge-neutral';
	}

	function reqText(r: Requirement) {
		return r.description ?? r.requirement ?? JSON.stringify(r);
	}

	const hasData = $derived(
		functional.length > 0 || nonFunctional.length > 0 || integrations.length > 0 || constraints.length > 0 || !!summary
	);
</script>

{#if !hasData}
	<pre class="fallback">{JSON.stringify(data, null, 2)}</pre>
{:else}
	{#if summary}
		<p class="summary">{summary}</p>
	{/if}

	{#each [
		{ label: 'Funcionais', items: functional },
		{ label: 'Não-funcionais', items: nonFunctional },
		{ label: 'Integrações', items: integrations },
		{ label: 'Restrições técnicas', items: constraints },
	] as group (group.label)}
		{#if group.items.length > 0}
			<div class="group">
				<div class="group-label">{group.label}</div>
				<ul class="req-list">
					{#each group.items as req, ri (ri)}
						<li class="req-item">
							<span class="req-text">{reqText(req)}</span>
							{#if req.complexity}
								<span class="badge {complexityClass(req.complexity)}">{req.complexity}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/each}
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

	.group {
		margin-bottom: 0.875rem;
	}

	.group-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.4rem;
	}

	.req-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.req-item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.03);
		font-size: 0.8125rem;
		color: #e5e7eb;
	}

	.req-text {
		flex: 1;
		line-height: 1.4;
	}

	.badge {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.badge-high   { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
	.badge-medium { background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
	.badge-low    { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }
	.badge-neutral { background: rgba(255, 255, 255, 0.08); color: #9ca3af; }

	.fallback {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.75rem;
		color: #d1d5db;
		white-space: pre-wrap;
		word-break: break-all;
		margin: 0;
	}
</style>
