<script lang="ts">
	import type { AgentStep } from '$lib/types/estimate';
	import { AGENT_LABELS } from '$lib/types/estimate';

	let {
		steps,
		activeKey,
		onstepclick,
	}: {
		steps: AgentStep[];
		activeKey: string | null;
		onstepclick: (agentKey: string) => void;
	} = $props();
</script>

<div class="ck-stepper">
	{#each steps as step, i (step.agent_key)}
		<button
			class="ck-step ck-step-{step.status}"
			class:ck-step-active={activeKey === step.agent_key}
			onclick={() => onstepclick(step.agent_key)}
			title={step.error ?? AGENT_LABELS[step.agent_key] ?? step.agent_key}
		>
			<div class="ck-step-track">
				<div class="ck-step-line" class:ck-line-hidden={i === 0}></div>
				<div class="ck-step-circle">
					{#if step.status === 'done'}✓{:else if step.status === 'failed'}✗{:else if step.status === 'running'}◉{:else}○{/if}
				</div>
				<div class="ck-step-line" class:ck-line-hidden={i === steps.length - 1}></div>
			</div>
			<div class="ck-step-label">{AGENT_LABELS[step.agent_key] ?? step.agent_key}</div>
			{#if step.duration_s}
				<div class="ck-step-meta">{step.duration_s.toFixed(0)}s</div>
			{:else if step.error}
				<div class="ck-step-meta ck-step-meta-err">erro</div>
			{/if}
		</button>
	{/each}
</div>

<style>
	.ck-stepper {
		display: flex;
		align-items: flex-start;
		width: 100%;
		margin-bottom: 1rem;
	}

	.ck-step {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		min-width: 0;
	}

	.ck-step-track {
		display: flex;
		align-items: center;
		width: 100%;
	}

	.ck-step-line {
		flex: 1;
		height: 2px;
		background: rgba(255,255,255,0.1);
		transition: background 0.3s;
	}

	.ck-line-hidden { background: transparent !important; }

	.ck-step-done .ck-step-line    { background: #10b981; }
	.ck-step-failed .ck-step-line  { background: rgba(239,68,68,.35); }

	.ck-step-circle {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 2px solid rgba(255,255,255,0.15);
		background: rgba(255,255,255,0.04);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		font-weight: 700;
		color: rgba(255,255,255,0.25);
		flex-shrink: 0;
		transition: all 0.2s;
	}

	.ck-step:hover .ck-step-circle { border-color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.08); }
	.ck-step-active .ck-step-circle { box-shadow: 0 0 0 3px rgba(99,102,241,.4); }

	.ck-step-done .ck-step-circle {
		border-color: #10b981;
		background: rgba(16,185,129,.15);
		color: #10b981;
	}

	.ck-step-failed .ck-step-circle {
		border-color: #f87171;
		background: rgba(239,68,68,.15);
		color: #f87171;
	}

	.ck-step-running .ck-step-circle {
		border-color: #818cf8;
		background: rgba(99,102,241,.15);
		color: #818cf8;
		animation: pulse-border 1.5s ease-in-out infinite;
	}

	@keyframes pulse-border {
		0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,.4); }
		50%       { box-shadow: 0 0 0 6px rgba(99,102,241,.0); }
	}

	.ck-step-label {
		font-size: 0.6875rem;
		text-align: center;
		color: rgba(255,255,255,0.4);
		line-height: 1.3;
		padding: 0 0.2rem;
		word-break: break-word;
	}

	.ck-step-done .ck-step-label    { color: rgba(255,255,255,0.8); }
	.ck-step-failed .ck-step-label  { color: #f87171; }
	.ck-step-running .ck-step-label { color: #818cf8; }
	.ck-step-active .ck-step-label  { font-weight: 600; }

	.ck-step-meta {
		font-size: 0.625rem;
		color: rgba(255,255,255,0.3);
		text-align: center;
	}

	.ck-step-meta-err { color: rgba(239,68,68,.7); cursor: help; }
</style>
