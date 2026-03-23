<script lang="ts">
	import type { Estimate, EstimateRun, AgentStep } from '$lib/types/estimate';
	import { AGENT_KEYS } from '$lib/types/estimate';
	import PipelineStepper from '$lib/components/admin/pipeline/PipelineStepper.svelte';
	import RunHistoryList from '$lib/components/admin/pipeline/RunHistoryList.svelte';
	import AgentStepCard from '$lib/components/admin/pipeline/AgentStepCard.svelte';
	import RunComparison from '$lib/components/admin/pipeline/RunComparison.svelte';

	let {
		interviewId,
		estimate,
		estimateRuns,
		rerunning,
		rerunMsg,
		fetchAgentOutput,
		onopenrerunmodal,
		ontriggerrerun,
	}: {
		interviewId: string;
		estimate: Estimate;
		estimateRuns: EstimateRun[];
		rerunning: boolean;
		rerunMsg: string;
		fetchAgentOutput: (interviewId: string, agentKey: string) => Promise<Record<string, unknown> | null>;
		onopenrerunmodal: () => void;
		ontriggerrerun: () => void;
	} = $props();

	let agentOutputKey = $state<string | null>(null);
	let agentOutputData = $state<Record<string, unknown> | null>(null);
	let loadingAgentOutput = $state(false);

	let compareRunA = $state<string | null>(null);
	let compareRunB = $state<string | null>(null);
	const showComparison = $derived(!!compareRunA && !!compareRunB);

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

	async function handleStepClick(agentKey: string) {
		if (agentOutputKey === agentKey) {
			agentOutputKey = null;
			agentOutputData = null;
			return;
		}
		agentOutputKey = agentKey;
		agentOutputData = null;
		loadingAgentOutput = true;
		try {
			agentOutputData = await fetchAgentOutput(interviewId, agentKey);
		} finally {
			loadingAgentOutput = false;
		}
	}
</script>

<div class="tab-content">
	<div class="pipeline-header">
		<div class="section-title">Pipeline de Agentes</div>
		<div class="pipeline-actions">
			{#if rerunMsg}
				<span class="pipeline-msg">{rerunMsg}</span>
			{/if}
			{#if estimate.status === 'pending_approval'}
				<button
					class="btn-rerun btn-start"
					onclick={ontriggerrerun}
					disabled={rerunning}
				>
					{rerunning ? 'Iniciando…' : 'Iniciar Pipeline'}
				</button>
			{:else}
				<button
					class="btn-rerun"
					onclick={onopenrerunmodal}
					disabled={rerunning || ['pending', 'running'].includes(estimate.status)}
				>
					{rerunning ? 'Iniciando…' : 'Re-run Pipeline'}
				</button>
			{/if}
		</div>
	</div>

	<PipelineStepper
		steps={displaySteps()}
		activeKey={agentOutputKey}
		onstepclick={handleStepClick}
	/>

	{#if agentOutputKey}
		<div class="step-output">
			{#if loadingAgentOutput}
				<span class="muted">Carregando output…</span>
			{:else if agentOutputData}
				<AgentStepCard agentKey={agentOutputKey} output={agentOutputData} />
			{:else}
				<span class="muted">Output não disponível</span>
			{/if}
		</div>
	{/if}

	<RunHistoryList
		runs={estimateRuns}
		oncompare={(a, b) => { compareRunA = a; compareRunB = b; }}
	/>

	{#if showComparison}
		<RunComparison
			{interviewId}
			runAId={compareRunA!}
			runBId={compareRunB!}
			onclose={() => { compareRunA = null; compareRunB = null; }}
		/>
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
		margin-bottom: 0.6rem;
	}

	.pipeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.pipeline-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.pipeline-msg {
		font-size: 0.8125rem;
		color: var(--color-success, #10b981);
	}

	.btn-rerun {
		padding: 0.35rem 0.9rem;
		background: var(--color-primary-600, #4f46e5);
		border: none;
		border-radius: 6px;
		color: #fff;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-rerun:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-start {
		background: var(--color-success, #10b981);
	}

	.step-output {
		padding: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		background: var(--color-dark-bg, #0f1117);
		border-radius: 6px;
		margin-bottom: 0.75rem;
	}

	.muted {
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.8125rem;
	}
</style>
