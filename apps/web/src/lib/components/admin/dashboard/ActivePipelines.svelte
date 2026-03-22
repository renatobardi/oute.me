<script lang="ts">
	import type { ActivePipeline } from '$lib/server/admin-dashboard';
	import PipelineStepper from '$lib/components/admin/pipeline/PipelineStepper.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import type { AgentStep } from '$lib/types/estimate';

	let { pipelines }: { pipelines: ActivePipeline[] } = $props();

	// Client-side elapsed timers
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	function elapsed(startedAt: string) {
		const secs = Math.floor((now - new Date(startedAt).getTime()) / 1000);
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return m > 0 ? `${m}m ${s}s` : `${s}s`;
	}
</script>

<div class="pipelines-card">
	<div class="section-title">
		Pipelines Ativos
		{#if pipelines.length > 0}
			<span class="count-badge">{pipelines.length}</span>
		{/if}
	</div>

	{#if pipelines.length === 0}
		<div class="empty">Nenhum pipeline em execução.</div>
	{:else}
		<div class="pipelines-list">
			{#each pipelines as pipeline (pipeline.estimate_id)}
				<div class="pipeline-row">
					<div class="pipeline-header">
						<div class="pipeline-info">
							<a class="pipeline-title" href="/admin/cockpit/{pipeline.interview_id}">
								{pipeline.interview_title ?? 'Sem título'}
							</a>
							<span class="pipeline-email">{pipeline.user_email}</span>
						</div>
						<div class="pipeline-status">
							<StatusBadge status={pipeline.estimate_status} />
							<span class="elapsed">{elapsed(pipeline.started_at)}</span>
						</div>
					</div>
					<PipelineStepper
						steps={pipeline.agent_steps as AgentStep[]}
						activeKey={null}
						onstepclick={() => {}}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pipelines-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.25rem 1.5rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.count-badge {
		background: rgba(99, 102, 241, 0.2);
		color: var(--color-primary-400, #818cf8);
		border-radius: 9999px;
		font-size: 0.7rem;
		padding: 0.1rem 0.45rem;
		font-weight: 700;
	}

	.empty {
		font-size: 0.875rem;
		color: var(--color-neutral-500, #6b7280);
		text-align: center;
		padding: 1rem 0;
	}

	.pipelines-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.pipeline-row {
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 0.875rem 1rem;
		background: rgba(255, 255, 255, 0.02);
	}

	.pipeline-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.875rem;
	}

	.pipeline-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.pipeline-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #f9fafb;
		text-decoration: none;
	}

	.pipeline-title:hover {
		color: var(--color-primary-400, #818cf8);
	}

	.pipeline-email {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.pipeline-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.elapsed {
		font-size: 0.75rem;
		font-family: monospace;
		color: var(--color-neutral-500, #6b7280);
	}
</style>
