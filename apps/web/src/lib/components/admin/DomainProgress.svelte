<script lang="ts">
	import type { DomainState } from '$lib/types/interview';

	let { domains }: { domains: Record<string, DomainState> } = $props();
</script>

<div class="section">
	<div class="section-title">Domínios</div>
	<div class="domains">
		{#each Object.entries(domains) as [domain, d] (domain)}
			<div class="domain-row">
				<span class="domain-name">{domain}</span>
				<div class="domain-bar-wrap">
					<div
						class="domain-bar-fill"
						style="width:{d.total ? Math.round(((d.answered ?? 0) / d.total) * 100) : 0}%"
					></div>
				</div>
				<span class="domain-count muted">{d.answered ?? 0}/{d.total}</span>
				{#if d.vital_answered}
					<span class="vital-ok">✓</span>
				{:else}
					<span class="vital-no">✗</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.section {
		margin-bottom: 1.25rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.6rem;
	}

	.domains {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.domain-row {
		display: grid;
		grid-template-columns: 100px 1fr 50px 20px;
		align-items: center;
		gap: 0.5rem;
	}

	.domain-name {
		font-size: 0.8rem;
		color: #d1d5db;
	}

	.domain-bar-wrap {
		height: 6px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 3px;
		overflow: hidden;
	}

	.domain-bar-fill {
		height: 100%;
		background: var(--color-primary-500, #6366f1);
		border-radius: 3px;
	}

	.domain-count {
		font-size: 0.75rem;
		text-align: right;
	}

	.vital-ok {
		color: var(--color-success, #10b981);
		font-size: 0.75rem;
	}

	.vital-no {
		color: var(--color-error, #ef4444);
		font-size: 0.75rem;
	}

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}
</style>
