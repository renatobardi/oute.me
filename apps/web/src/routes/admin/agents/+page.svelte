<script lang="ts">
	import type { AgentInstruction } from '$lib/server/agent-instructions';

	let { data } = $props();

	let instructions: AgentInstruction[] = data.instructions;

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('pt-BR');
	}
</script>

<svelte:head>
	<title>Agentes — Admin</title>
</svelte:head>

<div class="page">
	<nav class="admin-nav">
		<a href="/admin" class="nav-tab">Usuarios</a>
		<a href="/admin/knowledge" class="nav-tab">Base de Conhecimento</a>
		<a href="/admin/agents" class="nav-tab active">Agentes</a>
	</nav>

	<div class="header">
		<h1>Instrucoes dos Agentes</h1>
		<span class="count">{instructions.length} agente{instructions.length !== 1 ? 's' : ''}</span>
	</div>

	<div class="cards">
		{#each instructions as agent (agent.id)}
			<a href="/admin/agents/{agent.agent_key}" class="card">
				<div class="card-header">
					<h3>{agent.title}</h3>
					<span class="agent-key">{agent.agent_key}</span>
				</div>
				<div class="card-meta">
					<span class="char-count">{agent.content.length} caracteres</span>
					<span class="updated">Atualizado: {formatDate(agent.updated_at)}</span>
				</div>
				{#if agent.content}
					<p class="preview">{agent.content.slice(0, 120)}...</p>
				{:else}
					<p class="preview empty-preview">Sem instrucoes configuradas</p>
				{/if}
			</a>
		{/each}
	</div>
</div>

<style>
	.page {
		padding: 2rem 1.5rem;
		max-width: 1100px;
		margin: 0 auto;
	}

	.admin-nav {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	.nav-tab {
		padding: 0.6rem 1rem;
		color: var(--color-neutral-500, #6b7280);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		border-bottom: 2px solid transparent;
		transition: color 0.15s, border-color 0.15s;
	}

	.nav-tab:hover {
		color: var(--color-neutral-300, #d1d5db);
	}

	.nav-tab.active {
		color: var(--color-primary-500, #6366f1);
		border-bottom-color: var(--color-primary-500, #6366f1);
	}

	.header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0;
	}

	.count {
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
	}

	.card {
		display: block;
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		border-radius: 10px;
		padding: 1.25rem;
		text-decoration: none;
		transition: border-color 0.15s;
	}

	.card:hover {
		border-color: var(--color-primary-500, #6366f1);
	}

	.card-header {
		margin-bottom: 0.75rem;
	}

	.card-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: #f9fafb;
		margin: 0 0 0.25rem;
	}

	.agent-key {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		font-family: monospace;
	}

	.card-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.75rem;
	}

	.preview {
		font-size: 0.8125rem;
		color: var(--color-neutral-400, #9ca3af);
		line-height: 1.4;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
	}

	.empty-preview {
		color: var(--color-neutral-600, #4b5563);
		font-style: italic;
	}
</style>
