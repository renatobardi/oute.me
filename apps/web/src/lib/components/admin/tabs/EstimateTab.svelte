<script lang="ts">
	import type { Estimate, AgentStep } from '$lib/types/estimate';
	import { AGENT_LABELS, AGENT_KEYS } from '$lib/types/estimate';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { fmtDate } from '$lib/utils/admin';

	let { estimate }: { estimate: Estimate } = $props();

	const displaySteps = $derived((): AgentStep[] => {
		const steps = (estimate.agent_steps ?? []) as AgentStep[];
		return steps.length > 0
			? steps
			: AGENT_KEYS.map((k) => ({
					agent_key: k,
					status: 'pending',
					started_at: null,
					finished_at: null,
					duration_s: null,
					output_preview: null,
					error: null,
					llm_model: null,
					input_tokens: null,
					output_tokens: null,
				}));
	});
</script>

<div class="tab-content">
	<div class="section-title">Estimativa</div>
	<div class="info-list">
		<div class="info-row">
			<span class="info-row-label">ID</span>
			<span class="info-row-value mono">{estimate.id}</span>
		</div>
		<div class="info-row">
			<span class="info-row-label">Status</span>
			<span class="info-row-value">
				<StatusBadge status={estimate.status} />
			</span>
		</div>
		<div class="info-row">
			<span class="info-row-label">Criada em</span>
			<span class="info-row-value">{fmtDate(estimate.created_at)}</span>
		</div>
	</div>

	<div class="est-timeline">
		<div class="est-timeline-title">Agentes</div>
		<div class="est-timeline-steps">
			{#each displaySteps() as step (step.agent_key)}
				<div class="est-step est-step-{step.status}">
					<span class="est-step-dot">
						{#if step.status === 'done'}✓{:else if step.status === 'failed'}✗{:else if step.status === 'running'}◉{:else}○{/if}
					</span>
					<span class="est-step-name">{AGENT_LABELS[step.agent_key] ?? step.agent_key}</span>
					{#if step.duration_s}
						<span class="est-step-dur">{step.duration_s.toFixed(0)}s</span>
					{/if}
					{#if step.error}
						<span class="est-step-err" title={step.error}>!</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
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

	.info-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.info-row {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.info-row:last-child {
		border-bottom: none;
	}

	.info-row-label {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 110px;
		flex-shrink: 0;
	}

	.info-row-value {
		font-size: 0.875rem;
		color: #f9fafb;
		word-break: break-all;
	}

	.mono {
		font-family: monospace;
		font-size: 0.8rem;
		color: #a5f3fc;
	}

	/* Timeline */
	.est-timeline {
		margin-top: 1.25rem;
	}

	.est-timeline-title {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(255, 255, 255, 0.35);
		margin-bottom: 0.625rem;
	}

	.est-timeline-steps {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.est-step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.625rem;
		border-radius: 6px;
		font-size: 0.8125rem;
		border: 1px solid rgba(255, 255, 255, 0.05);
		background: rgba(255, 255, 255, 0.02);
	}

	.est-step-done    { border-color: rgba(16,185,129,.25);  background: rgba(16,185,129,.06); }
	.est-step-failed  { border-color: rgba(239,68,68,.25);   background: rgba(239,68,68,.06);  }
	.est-step-running { border-color: rgba(99,102,241,.35);  background: rgba(99,102,241,.08); }

	.est-step-dot {
		font-size: 0.8125rem;
		font-weight: 700;
		line-height: 1;
		flex-shrink: 0;
		width: 16px;
		text-align: center;
	}

	.est-step-done    .est-step-dot { color: #10b981; }
	.est-step-failed  .est-step-dot { color: #f87171; }
	.est-step-running .est-step-dot { color: #818cf8; }
	.est-step-pending .est-step-dot { color: rgba(255, 255, 255, 0.2); }

	.est-step-name {
		flex: 1;
		color: rgba(255, 255, 255, 0.6);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.est-step-done .est-step-name { color: rgba(255, 255, 255, 0.85); }

	.est-step-dur {
		font-size: 0.6875rem;
		color: rgba(255, 255, 255, 0.3);
		flex-shrink: 0;
	}

	.est-step-err {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: rgba(239, 68, 68, .25);
		color: #f87171;
		font-size: 0.625rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: help;
		flex-shrink: 0;
	}
</style>
