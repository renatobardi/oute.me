<script lang="ts">
	import type { Component } from 'svelte';
	import RequirementsView from './renderers/RequirementsView.svelte';
	import SimilarProjectsView from './renderers/SimilarProjectsView.svelte';
	import ArchitectureView from './renderers/ArchitectureView.svelte';
	import CostScenariosView from './renderers/CostScenariosView.svelte';
	import ReviewView from './renderers/ReviewView.svelte';
	import KnowledgeView from './renderers/KnowledgeView.svelte';
	import { AGENT_LABELS } from '$lib/types/estimate';

	const RENDERERS: Record<string, Component<{ data: Record<string, unknown> }>> = {
		architecture_interviewer: RequirementsView,
		rag_analyst: SimilarProjectsView,
		software_architect: ArchitectureView,
		cost_specialist: CostScenariosView,
		reviewer: ReviewView,
		knowledge_manager: KnowledgeView,
	};

	let {
		agentKey,
		output,
	}: {
		agentKey: string;
		output: Record<string, unknown>;
	} = $props();

	const Renderer = $derived(RENDERERS[agentKey] as Component<{ data: Record<string, unknown> }> | undefined);
	const label = $derived(AGENT_LABELS[agentKey] ?? agentKey);
</script>

<div class="card">
	<div class="card-header">
		<span class="agent-label">{label}</span>
	</div>
	<div class="card-body">
		{#if Renderer}
			{@const R = Renderer}
			<R data={output} />
		{:else}
			<pre class="fallback">{JSON.stringify(output, null, 2)}</pre>
		{/if}
	</div>
</div>

<style>
	.card {
		background: var(--color-dark-bg, #0f1117);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		overflow: hidden;
	}

	.card-header {
		padding: 0.5rem 0.875rem;
		background: rgba(255, 255, 255, 0.03);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.agent-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
	}

	.card-body {
		padding: 0.875rem;
	}

	.fallback {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.75rem;
		color: #d1d5db;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 400px;
		overflow-y: auto;
		margin: 0;
	}
</style>
