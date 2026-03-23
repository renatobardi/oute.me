<script lang="ts">
	let { data }: { data: Record<string, unknown> } = $props();

	type SimilarProject = {
		title?: string;
		name?: string;
		relevance_score?: number;
		description?: string;
		estimated_duration_weeks?: number;
		duration_weeks?: number;
		team_size?: number;
		tech_stack?: string[];
	};

	const projects = $derived(
		(data?.similar_projects ?? data?.projects ?? []) as SimilarProject[]
	);
	const benchmarks = $derived(data?.market_benchmarks as Record<string, unknown> | null ?? null);
	const summary = $derived(data?.analysis_summary ?? data?.summary ?? null);

	function relevancePct(score?: number) {
		if (score == null) return 0;
		return Math.round((score > 1 ? score : score * 100));
	}

	function relevanceColor(score?: number) {
		const pct = relevancePct(score);
		if (pct >= 80) return 'var(--color-success, #10b981)';
		if (pct >= 60) return 'rgba(245, 158, 11, 0.8)';
		return 'rgba(239, 68, 68, 0.7)';
	}

	const hasData = $derived(projects.length > 0 || !!benchmarks || !!summary);
</script>

{#if !hasData}
	<pre class="fallback">{JSON.stringify(data, null, 2)}</pre>
{:else}
	{#if summary}
		<p class="summary">{summary as string}</p>
	{/if}

	{#if projects.length > 0}
		<div class="projects-grid">
			{#each projects as proj, pi (pi)}
				<div class="proj-card">
					<div class="proj-header">
						<span class="proj-name">{proj.title ?? proj.name ?? 'Projeto'}</span>
						{#if proj.relevance_score != null}
							<span class="relevance-pct">{relevancePct(proj.relevance_score)}%</span>
						{/if}
					</div>
					{#if proj.relevance_score != null}
						<div class="relevance-bar-track">
							<div
								class="relevance-bar-fill"
								style="width: {relevancePct(proj.relevance_score)}%; background: {relevanceColor(proj.relevance_score)};"
							></div>
						</div>
					{/if}
					{#if proj.description}
						<p class="proj-desc">{proj.description}</p>
					{/if}
					<div class="proj-meta">
						{#if proj.estimated_duration_weeks ?? proj.duration_weeks}
							<span class="meta-pill">{proj.estimated_duration_weeks ?? proj.duration_weeks}s semanas</span>
						{/if}
						{#if proj.team_size}
							<span class="meta-pill">{proj.team_size} devs</span>
						{/if}
					</div>
					{#if proj.tech_stack?.length}
						<div class="tech-tags">
							{#each proj.tech_stack as tech (tech)}
								<span class="tech-tag">{tech}</span>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if benchmarks}
		<div class="benchmarks">
			<div class="bench-title">Benchmarks de Mercado</div>
			<div class="bench-grid">
				{#each Object.entries(benchmarks) as [k, v] (k)}
					<div class="bench-item">
						<span class="bench-key">{k.replace(/_/g, ' ')}</span>
						<span class="bench-val">{v}</span>
					</div>
				{/each}
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

	.projects-grid {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-bottom: 1rem;
	}

	.proj-card {
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 7px;
	}

	.proj-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.375rem;
	}

	.proj-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: #f3f4f6;
	}

	.relevance-pct {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-primary-400, #818cf8);
	}

	.relevance-bar-track {
		height: 4px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		margin-bottom: 0.5rem;
		overflow: hidden;
	}

	.relevance-bar-fill {
		height: 100%;
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.proj-desc {
		font-size: 0.8rem;
		color: #9ca3af;
		line-height: 1.5;
		margin: 0 0 0.5rem;
	}

	.proj-meta {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-bottom: 0.375rem;
	}

	.meta-pill {
		font-size: 0.7rem;
		padding: 0.15rem 0.5rem;
		background: rgba(99, 102, 241, 0.12);
		color: var(--color-primary-400, #818cf8);
		border-radius: 9999px;
	}

	.tech-tags {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.tech-tag {
		font-size: 0.65rem;
		padding: 0.1rem 0.4rem;
		background: rgba(255, 255, 255, 0.07);
		color: #9ca3af;
		border-radius: 4px;
	}

	.benchmarks {
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 7px;
	}

	.bench-title {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.5rem;
	}

	.bench-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.5rem;
	}

	.bench-item {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.bench-key {
		font-size: 0.7rem;
		color: #6b7280;
		text-transform: capitalize;
	}

	.bench-val {
		font-size: 0.875rem;
		font-weight: 600;
		color: #e5e7eb;
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
