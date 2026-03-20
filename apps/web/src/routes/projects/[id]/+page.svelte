<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button, StatusBadge, MetricDisplay, ProgressBar } from '@oute/ui';
	import '@oute/ui/theme.css';
	import type { ProjectTask } from '$lib/types/project';

	let { data } = $props();

	let project = $derived(data.project);
	let milestones = $derived(data.milestones);
	let tasks = $derived(data.tasks);
	let documents = $derived(data.documents);

	let completedMilestones = $derived(milestones.filter((m) => m.status === 'done').length);
	let totalTasks = $derived(tasks.length);
	let completedTasks = $derived(tasks.filter((t) => t.status === 'done').length);

	function tasksForMilestone(milestoneId: string): ProjectTask[] {
		return tasks.filter((t) => t.milestone_id === milestoneId);
	}

	function formatCurrency(value: number | null): string {
		if (value == null) return '—';
		return new Intl.NumberFormat('pt-BR', {
			style: 'currency',
			currency: 'BRL',
			maximumFractionDigits: 0,
		}).format(value);
	}

	async function updateMilestone(milestoneId: string, status: string) {
		await fetch(`/api/projects/${project.id}/milestones/${milestoneId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status }),
		});
		await invalidateAll();
	}

	async function updateTask(milestoneId: string, taskId: string, status: string) {
		await fetch(`/api/projects/${project.id}/milestones/${milestoneId}/tasks`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ task_id: taskId, status }),
		});
		await invalidateAll();
	}

	async function updateProjectStatus(status: string) {
		await fetch(`/api/projects/${project.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status }),
		});
		await invalidateAll();
	}

	let newTaskTitle = $state('');
	let addingToMilestone = $state<string | null>(null);

	async function addTask(milestoneId: string) {
		if (!newTaskTitle.trim()) return;
		await fetch(`/api/projects/${project.id}/milestones/${milestoneId}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: newTaskTitle }),
		});
		newTaskTitle = '';
		addingToMilestone = null;
		await invalidateAll();
	}

	const statusCycle: Record<string, string> = {
		todo: 'in_progress',
		in_progress: 'done',
		done: 'todo',
	};

	const statusIcons: Record<string, string> = {
		todo: '\u25CB',
		in_progress: '\u25D4',
		done: '\u25CF',
	};
</script>

<svelte:head>
	<title>{project.name} — oute.pro</title>
</svelte:head>

<div class="project-page">
	<header class="page-header">
		<button class="back-btn" onclick={() => goto('/projects')}>&larr; Projetos</button>
		<div class="header-top">
			<div class="header-info">
				<h1>{project.name}</h1>
				<StatusBadge status={project.status} />
			</div>
			<div class="header-actions">
				{#if project.status === 'active'}
					<Button variant="secondary" size="sm" onclick={() => updateProjectStatus('paused')}>
						Pausar
					</Button>
					<Button variant="primary" size="sm" onclick={() => updateProjectStatus('completed')}>
						Concluir
					</Button>
				{:else if project.status === 'paused'}
					<Button variant="primary" size="sm" onclick={() => updateProjectStatus('active')}>
						Retomar
					</Button>
				{/if}
			</div>
		</div>
	</header>

	<!-- Metrics -->
	<div class="metrics-row">
		<MetricDisplay label="Custo Total" value={formatCurrency(project.total_cost)} variant="highlight" />
		<MetricDisplay label="Duração" value={project.duration_weeks ?? '—'} unit="semanas" />
		<MetricDisplay label="Equipe" value={project.team_size ?? '—'} unit="pessoas" />
		<MetricDisplay label="Horas" value={project.total_hours ? Math.round(project.total_hours) : '—'} unit="h" />
	</div>

	<!-- Progress -->
	<div class="progress-section">
		<ProgressBar
			value={completedMilestones}
			max={milestones.length || 1}
			label="Milestones"
			variant={completedMilestones === milestones.length && milestones.length > 0 ? 'success' : 'primary'}
		/>
		<ProgressBar
			value={completedTasks}
			max={totalTasks || 1}
			label="Tasks"
			variant={completedTasks === totalTasks && totalTasks > 0 ? 'success' : 'primary'}
		/>
	</div>

	<!-- Documents -->
	{#if documents.length > 0}
		<section class="documents-section">
			<h2>Documentos ({documents.length})</h2>
			<div class="documents-grid">
				{#each documents as doc (doc.id)}
					<div class="document-card">
						<div class="doc-icon">
							{#if doc.mime_type?.includes('pdf')}
								<span>PDF</span>
							{:else if doc.mime_type?.includes('word') || doc.mime_type?.includes('docx')}
								<span>DOC</span>
							{:else if doc.mime_type?.includes('sheet') || doc.mime_type?.includes('xlsx') || doc.mime_type?.includes('csv')}
								<span>XLS</span>
							{:else if doc.mime_type?.includes('image')}
								<span>IMG</span>
							{:else}
								<span>ARQ</span>
							{/if}
						</div>
						<div class="doc-info">
							<span class="doc-name">{doc.filename}</span>
							<span class="doc-meta">
								{doc.status === 'processed' ? 'Processado' : doc.status === 'processing' ? 'Processando...' : doc.status}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Milestones -->
	<section class="milestones-section">
		<h2>Milestones</h2>
		{#each milestones as milestone, i (milestone.id)}
			{@const mTasks = tasksForMilestone(milestone.id)}
			{@const mDone = mTasks.filter((t) => t.status === 'done').length}
			<div class="milestone-card milestone-{milestone.status}">
				<div class="milestone-header">
					<div class="milestone-left">
						<span class="milestone-number">{i + 1}</span>
						<div>
							<h3>{milestone.name}</h3>
							<span class="milestone-meta">
								{milestone.duration_weeks} sem
								{#if mTasks.length > 0}
									&middot; {mDone}/{mTasks.length} tasks
								{/if}
							</span>
						</div>
					</div>
					<div class="milestone-actions">
						{#if milestone.status === 'pending'}
							<Button variant="ghost" size="sm" onclick={() => updateMilestone(milestone.id, 'in_progress')}>
								Iniciar
							</Button>
						{:else if milestone.status === 'in_progress'}
							<Button variant="ghost" size="sm" onclick={() => updateMilestone(milestone.id, 'done')}>
								Concluir
							</Button>
						{/if}
					</div>
				</div>

				{#if milestone.description}
					<p class="milestone-desc">{milestone.description}</p>
				{/if}

				<!-- Tasks -->
				{#if mTasks.length > 0 || addingToMilestone === milestone.id}
					<div class="tasks-list">
						{#each mTasks as task (task.id)}
							<div class="task-item task-{task.status}">
								<button
									class="task-toggle"
									onclick={() => updateTask(milestone.id, task.id, statusCycle[task.status] || 'todo')}
									title="Alternar status"
								>
									{statusIcons[task.status] || '\u25CB'}
								</button>
								<span class="task-title" class:task-done={task.status === 'done'}>{task.title}</span>
								{#if task.estimated_hours}
									<span class="task-hours">{task.estimated_hours}h</span>
								{/if}
							</div>
						{/each}

						{#if addingToMilestone === milestone.id}
							<div class="add-task-form">
								<input
									type="text"
									bind:value={newTaskTitle}
									placeholder="Nome da task..."
									onkeydown={(e) => { if (e.key === 'Enter') addTask(milestone.id); }}
								/>
								<Button size="sm" onclick={() => addTask(milestone.id)}>Adicionar</Button>
								<Button variant="ghost" size="sm" onclick={() => { addingToMilestone = null; }}>
									Cancelar
								</Button>
							</div>
						{/if}
					</div>
				{/if}

				{#if addingToMilestone !== milestone.id}
					<button class="add-task-btn" onclick={() => { addingToMilestone = milestone.id; }}>
						+ Adicionar task
					</button>
				{/if}
			</div>
		{/each}
	</section>
</div>

<style>
	.project-page {
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

	.back-btn {
		background: none;
		border: none;
		color: var(--color-primary-500, #6366f1);
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0;
		margin-bottom: 0.75rem;
	}

	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.header-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-info h1 {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.metrics-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.progress-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	/* documents */
	.documents-section {
		margin-bottom: 2rem;
	}

	.documents-section h2 {
		font-size: 1.25rem;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 1rem;
	}

	.documents-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.document-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 10px;
		padding: 0.875rem 1rem;
	}

	.doc-icon {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: rgba(99, 102, 241, 0.15);
		color: var(--color-primary-500, #6366f1);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.doc-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.doc-name {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.85);
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.doc-meta {
		font-size: 0.7rem;
		color: rgba(255, 255, 255, 0.4);
	}

	.milestones-section h2 {
		font-size: 1.25rem;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 1rem;
	}

	.milestone-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 1.25rem;
		margin-bottom: 0.75rem;
	}

	.milestone-in_progress {
		border-left: 3px solid var(--color-primary-500, #6366f1);
	}

	.milestone-done {
		border-left: 3px solid var(--color-success, #10b981);
	}

	.milestone-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.milestone-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.milestone-number {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--color-primary-500, #6366f1);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.milestone-header h3 {
		margin: 0;
		color: rgba(255, 255, 255, 0.9);
		font-size: 1rem;
	}

	.milestone-meta {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.45);
	}

	.milestone-desc {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.5);
		margin: 0.5rem 0;
	}

	.tasks-list {
		margin-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.task-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 6px;
	}

	.task-item:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.task-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		padding: 0;
		color: rgba(255, 255, 255, 0.4);
		width: 20px;
		text-align: center;
	}

	.task-in_progress .task-toggle {
		color: var(--color-primary-500, #6366f1);
	}

	.task-done .task-toggle {
		color: var(--color-success, #10b981);
	}

	.task-title {
		flex: 1;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.8);
	}

	.task-done {
		text-decoration: line-through;
		color: rgba(255, 255, 255, 0.35);
	}

	.task-hours {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.35);
	}

	.add-task-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.35);
		cursor: pointer;
		font-size: 0.8125rem;
		padding: 0.375rem 0;
		margin-top: 0.25rem;
	}

	.add-task-btn:hover {
		color: var(--color-primary-500, #6366f1);
	}

	.add-task-form {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0;
	}

	.add-task-form input {
		flex: 1;
		background: var(--color-dark-bg, #0f1117);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		padding: 0.375rem 0.625rem;
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
	}

	.add-task-form input:focus {
		border-color: var(--color-primary-500, #6366f1);
	}
</style>
