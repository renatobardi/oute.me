<script lang="ts">
	import type { Milestone, TechRecommendation, RiskItem } from '$lib/types/estimate';

	let { data }: { data: Record<string, unknown> } = $props();

	const overview = $derived(
		(data?.architecture_overview ?? data?.overview ?? data?.summary ?? null) as string | null
	);
	const milestones = $derived((data?.milestones ?? []) as Milestone[]);
	const techRecs = $derived(
		(data?.tech_recommendations ?? data?.tech_stack ?? []) as TechRecommendation[]
	);
	const risks = $derived((data?.risks ?? []) as RiskItem[]);

	function impactClass(impact?: string) {
		const l = (impact ?? '').toLowerCase();
		if (l === 'high' || l === 'alto') return 'risk-high';
		if (l === 'medium' || l === 'médio' || l === 'medio') return 'risk-medium';
		return 'risk-low';
	}

	const hasData = $derived(!!overview || milestones.length > 0 || techRecs.length > 0 || risks.length > 0);
</script>

{#if !hasData}
	<pre class="fallback">{JSON.stringify(data, null, 2)}</pre>
{:else}
	{#if overview}
		<div class="section">
			<div class="section-label">Visão Geral da Arquitetura</div>
			<p class="prose">{overview}</p>
		</div>
	{/if}

	{#if milestones.length > 0}
		<div class="section">
			<div class="section-label">Milestones</div>
			<div class="milestones">
				{#each milestones as ms, i (i)}
					<div class="ms-row">
						<div class="ms-index">{i + 1}</div>
						<div class="ms-body">
							<div class="ms-header">
								<span class="ms-name">{ms.name}</span>
								{#if ms.duration_weeks}
									<span class="ms-weeks">{ms.duration_weeks}s semanas</span>
								{/if}
							</div>
							{#if ms.description}
								<p class="ms-desc">{ms.description}</p>
							{/if}
							{#if ms.deliverables?.length}
								<div class="deliverables">
									{#each ms.deliverables as d (d)}
										<span class="deliverable">{d}</span>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if techRecs.length > 0}
		<div class="section">
			<div class="section-label">Tech Stack</div>
			<div class="tech-grid">
				{#each techRecs as rec, ri (ri)}
					<div class="tech-card">
						<div class="tech-header">
							<span class="tech-category">{rec.category}</span>
							<span class="tech-name">{rec.technology}</span>
						</div>
						{#if rec.justification}
							<p class="tech-just">{rec.justification}</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if risks.length > 0}
		<div class="section">
			<div class="section-label">Risk Matrix</div>
			<div class="risks">
				{#each risks as risk, rki (rki)}
					<div class="risk-row {impactClass(risk.impact)}">
						<div class="risk-meta">
							<span class="risk-label">{risk.description}</span>
							{#if risk.impact}
								<span class="risk-badge">{risk.impact}</span>
							{/if}
						</div>
						{#if risk.mitigation}
							<p class="risk-mitigation">Mitigação: {risk.mitigation}</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/if}

<style>
	.section {
		margin-bottom: 1.125rem;
	}

	.section-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.5rem;
	}

	.prose {
		font-size: 0.8125rem;
		color: #d1d5db;
		line-height: 1.6;
		margin: 0;
		padding: 0.625rem 0.75rem;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 6px;
	}

	/* Milestones */
	.milestones {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ms-row {
		display: flex;
		gap: 0.75rem;
		padding: 0.625rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
	}

	.ms-index {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: rgba(99, 102, 241, 0.2);
		color: var(--color-primary-400, #818cf8);
		font-size: 0.7rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ms-body {
		flex: 1;
	}

	.ms-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.2rem;
	}

	.ms-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f3f4f6;
	}

	.ms-weeks {
		font-size: 0.7rem;
		color: var(--color-primary-400, #818cf8);
	}

	.ms-desc {
		font-size: 0.775rem;
		color: #9ca3af;
		margin: 0 0 0.375rem;
		line-height: 1.4;
	}

	.deliverables {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.deliverable {
		font-size: 0.65rem;
		padding: 0.1rem 0.4rem;
		background: rgba(255, 255, 255, 0.06);
		color: #9ca3af;
		border-radius: 4px;
	}

	/* Tech */
	.tech-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.5rem;
	}

	.tech-card {
		padding: 0.625rem;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.tech-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.tech-category {
		font-size: 0.65rem;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.tech-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-primary-300, #a5b4fc);
	}

	.tech-just {
		font-size: 0.75rem;
		color: #9ca3af;
		margin: 0;
		line-height: 1.4;
	}

	/* Risks */
	.risks {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.risk-row {
		padding: 0.5rem 0.625rem;
		border-radius: 6px;
		border-left: 3px solid transparent;
	}

	.risk-high   { background: rgba(239, 68, 68, 0.08); border-left-color: #ef4444; }
	.risk-medium { background: rgba(245, 158, 11, 0.08); border-left-color: #f59e0b; }
	.risk-low    { background: rgba(16, 185, 129, 0.08); border-left-color: #10b981; }

	.risk-meta {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.2rem;
	}

	.risk-label {
		font-size: 0.8125rem;
		color: #e5e7eb;
		line-height: 1.4;
	}

	.risk-badge {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #9ca3af;
		flex-shrink: 0;
	}

	.risk-mitigation {
		font-size: 0.75rem;
		color: #9ca3af;
		margin: 0;
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
