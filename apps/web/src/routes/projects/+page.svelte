<script lang="ts">
	import { goto } from '$app/navigation';
	import { StatusBadge } from '@oute/ui';
	import '@oute/ui/theme.css';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let projects = $state(data.projects);
	let filter = $state<'all' | 'active' | 'archived'>('active');

	const filtered = $derived(() => {
		const base = filter === 'all'
			? projects
			: projects.filter((p) => p.status === filter);

		return [...base].sort((a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);
	});

	function formatCurrency(value: number | null): string {
		if (value == null) return '—';
		return new Intl.NumberFormat('pt-BR', {
			style: 'currency',
			currency: 'BRL',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('pt-BR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		});
	}
</script>

<svelte:head>
	<title>Meus Projetos — oute.pro</title>
</svelte:head>

<div class="projects-page">
	<header class="page-header">
		<h1>Meus Projetos</h1>
	</header>

	{#if projects.length === 0}
		<div class="empty-state">
			<p>Nenhum projeto criado ainda.</p>
			<p class="empty-hint">Aprove uma estimativa para criar seu primeiro projeto.</p>
		</div>
	{:else}
		<div class="filter-bar">
			<button
				class="filter-btn"
				class:active={filter === 'active'}
				onclick={() => (filter = 'active')}
			>
				Ativos
			</button>
			<button
				class="filter-btn"
				class:active={filter === 'all'}
				onclick={() => (filter = 'all')}
			>
				Todos
			</button>
			<button
				class="filter-btn"
				class:active={filter === 'archived'}
				onclick={() => (filter = 'archived')}
			>
				Arquivados
			</button>
		</div>

		{#if filtered().length === 0}
			<div class="empty-filtered">
				Nenhum projeto {filter === 'active' ? 'ativo' : 'arquivado'} encontrado.
			</div>
		{:else}
			<div class="projects-grid">
				{#each filtered() as project (project.id)}
					<button class="project-card" onclick={() => goto(`/projects/${project.id}`)}>
						<div class="project-header">
							<h2>{project.name}</h2>
							<StatusBadge status={project.status} size="sm" />
						</div>
						{#if project.description}
							<p class="project-desc">{project.description}</p>
						{/if}
						<div class="project-meta">
							{#if project.total_cost}
								<span class="meta-item">{formatCurrency(project.total_cost)}</span>
							{/if}
							{#if project.duration_weeks}
								<span class="meta-item">{project.duration_weeks} semanas</span>
							{/if}
							{#if project.team_size}
								<span class="meta-item">{project.team_size} pessoas</span>
							{/if}
						</div>
						<span class="project-date">Criado em {formatDate(project.created_at)}</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.projects-page {
		min-height: 100vh;
		background: var(--color-dark-bg, #0f1117);
		color: var(--color-neutral-300, #d1d5db);
		padding: 2rem;
		max-width: 960px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
	}

	/* Filter bar */
	.filter-bar {
		display: flex;
		gap: 0.375rem;
		margin-bottom: 1.5rem;
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		border-radius: 8px;
		padding: 0.25rem;
		width: fit-content;
	}

	.filter-btn {
		padding: 0.375rem 1rem;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.filter-btn:hover {
		color: var(--color-neutral-300, #d1d5db);
	}

	.filter-btn.active {
		background: var(--color-dark-sidebar, #2a2d3a);
		color: var(--color-neutral-100, #f3f4f6);
	}

	/* Empty states */
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.empty-hint {
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.empty-filtered {
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.875rem;
		padding: 2rem 0;
	}

	/* Grid */
	.projects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}

	.project-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 1.25rem;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font-family: inherit;
		transition: border-color 0.2s;
		width: 100%;
	}

	.project-card:hover {
		border-color: var(--color-primary-500, #6366f1);
	}

	.project-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.5rem;
	}

	.project-header h2 {
		font-size: 1.125rem;
		color: rgba(255, 255, 255, 0.9);
		margin: 0;
	}

	.project-desc {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 0.75rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.project-meta {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.meta-item {
		font-size: 0.8125rem;
		color: var(--color-primary-500, #6366f1);
		font-weight: 500;
	}

	.project-date {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.35);
	}
</style>
