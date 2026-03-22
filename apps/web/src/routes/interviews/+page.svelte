<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import { Button, SectionHeader, StatusBadge, MaturityBar } from '@oute/ui';

	let { data } = $props();
	let creating = $state(false);
	let filter = $state<'all' | 'active' | 'archived'>('active');
	let interviews = $state(data.interviews);

	const counts = $derived(() => ({
		active: interviews.filter(i => i.status === 'active').length,
		archived: interviews.filter(i => i.status === 'archived').length,
		all: interviews.length,
	}));

	const filtered = $derived(() => {
		const base = filter === 'all'
			? interviews
			: interviews.filter(i => i.status === filter);

		return [...base].sort((a, b) => {
			if (a.status === 'archived' && b.status !== 'archived') return 1;
			if (a.status !== 'archived' && b.status === 'archived') return -1;
			return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		});
	});

	async function createInterview() {
		creating = true;
		try {
			const res = await fetch('/api/interviews', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});
			if (res.ok) {
				const { interview } = await res.json();
				await goto(resolveRoute('/interviews/[id]', { id: interview.id }));
			}
		} finally {
			creating = false;
		}
	}

	async function toggleArchive(event: MouseEvent, interviewId: string, current: string) {
		event.preventDefault();
		event.stopPropagation();

		const newStatus = current === 'archived' ? 'active' : 'archived';
		const res = await fetch(`/api/interviews/${interviewId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: newStatus }),
		});

		if (res.ok) {
			interviews = interviews.map(i =>
				i.id === interviewId ? { ...i, status: newStatus } : i
			);
		}
	}

	function formatRelativeTime(date: string | Date): string {
		const now = new Date();
		const past = new Date(date);
		const diffMs = now.getTime() - past.getTime();
		const diffMinutes = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMinutes < 1) return 'agora';
		if (diffMinutes < 60) return `há ${diffMinutes} min`;
		if (diffHours < 24) return `há ${diffHours}h`;
		if (diffDays === 1) return 'ontem';
		if (diffDays < 7) return `há ${diffDays} dias`;
		if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} sem`;
		if (diffDays < 365) return `há ${Math.floor(diffDays / 30)} meses`;
		return `há ${Math.floor(diffDays / 365)} ano${Math.floor(diffDays / 365) > 1 ? 's' : ''}`;
	}

	function maturityColor(maturity: number): string {
		if (maturity >= 0.7) return 'var(--color-success, #10b981)';
		if (maturity >= 0.4) return 'var(--color-warning, #f59e0b)';
		return 'var(--color-error, #ef4444)';
	}
</script>

<svelte:head>
	<title>Entrevistas — oute.pro</title>
</svelte:head>

<div class="page">
	{#if interviews.length > 0}
		<SectionHeader title="Minhas Entrevistas">
			<Button onclick={createInterview} disabled={creating}>
				{creating ? 'Criando...' : 'Nova Entrevista'}
			</Button>
		</SectionHeader>
	{:else}
		<SectionHeader title="Minhas Entrevistas" />
	{/if}

	{#if interviews.length === 0}
		<div class="empty">
			<div class="empty-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					<line x1="9" y1="9" x2="15" y2="9"/>
					<line x1="9" y1="13" x2="13" y2="13"/>
				</svg>
			</div>
			<p class="empty-title">Nenhuma entrevista ainda</p>
			<p class="empty-subtitle">Crie a primeira para começar a estimar seu projeto!</p>
			<Button onclick={createInterview} disabled={creating}>
				{creating ? 'Criando...' : 'Nova Entrevista'}
			</Button>
		</div>
	{:else}
		<div class="filter-bar">
			<button
				class="filter-btn"
				class:active={filter === 'active'}
				onclick={() => filter = 'active'}
			>
				Ativos
				<span class="filter-count">{counts().active}</span>
			</button>
			<button
				class="filter-btn"
				class:active={filter === 'all'}
				onclick={() => filter = 'all'}
			>
				Todos
				<span class="filter-count">{counts().all}</span>
			</button>
			<button
				class="filter-btn"
				class:active={filter === 'archived'}
				onclick={() => filter = 'archived'}
			>
				Arquivados
				<span class="filter-count">{counts().archived}</span>
			</button>
		</div>

		{#if filtered().length === 0}
			<div class="empty-filter">
				<p>Nenhuma entrevista {filter === 'archived' ? 'arquivada' : 'ativa'} encontrada.</p>
			</div>
		{:else}
			<div class="grid">
				{#each filtered() as interview (interview.id)}
					{@const isArchived = interview.status === 'archived'}
					{@const maturityPct = Math.round(interview.maturity * 100)}
					<a
						href={resolveRoute('/interviews/[id]', { id: interview.id })}
						class="card"
						class:card--archived={isArchived}
					>
						<div class="card-header">
							<h3 class="card-title">{interview.title || 'Sem título'}</h3>
							<button
								class="archive-btn"
								class:archive-btn--active={isArchived}
								title={isArchived ? 'Reativar' : 'Arquivar'}
								onclick={(e) => toggleArchive(e, interview.id, interview.status)}
							>
								{#if isArchived}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="1 4 1 10 7 10"/>
										<path d="M3.51 15a9 9 0 1 0 .49-3.47"/>
									</svg>
									Reativar
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="21 8 21 21 3 21 3 8"/>
										<rect x="1" y="3" width="22" height="5"/>
										<line x1="10" y1="12" x2="14" y2="12"/>
									</svg>
									Arquivar
								{/if}
							</button>
						</div>

						<div class="card-maturity">
							<div class="maturity-label">
								<span class="maturity-text">Maturidade</span>
								<span class="maturity-pct" style="color: {maturityColor(interview.maturity)}">
									{maturityPct}%
								</span>
							</div>
							<MaturityBar
								maturity={interview.maturity}
								domains={interview.state.domains}
							/>
						</div>

						<div class="card-footer">
							<StatusBadge status={interview.status} size="sm" />
							<time
								datetime={new Date(interview.updated_at).toISOString()}
								title={new Date(interview.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
							>
								atualizado {formatRelativeTime(interview.updated_at)}
							</time>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
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
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.875rem;
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

	.filter-count {
		font-size: 0.7rem;
		font-weight: 600;
		background: var(--color-dark-bg, #0f1117);
		color: var(--color-neutral-500, #6b7280);
		border-radius: 999px;
		padding: 0.1rem 0.45rem;
		min-width: 1.25rem;
		text-align: center;
	}

	.filter-btn.active .filter-count {
		background: rgba(99, 102, 241, 0.15);
		color: var(--color-primary-500, #6366f1);
	}

	/* Empty state */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 5rem 1rem;
		text-align: center;
	}

	.empty-icon {
		color: var(--color-neutral-700, #374151);
	}

	.empty-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-neutral-300, #d1d5db);
		margin: 0;
	}

	.empty-subtitle {
		color: var(--color-neutral-500, #6b7280);
		margin: 0;
	}

	.empty-filter {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
	}

	.empty-filter p {
		margin: 0;
	}

	/* Grid */
	.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
	}

	/* Card */
	.card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		border-radius: 12px;
		text-decoration: none;
		transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s, opacity 0.2s;
	}

	.card:hover {
		border-color: var(--color-primary-500, #6366f1);
		background-color: var(--color-dark-sidebar, #2a2d3a);
		box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15), 0 4px 16px rgba(99, 102, 241, 0.08);
	}

	.card--archived {
		opacity: 0.45;
		filter: grayscale(0.6);
	}

	.card--archived:hover {
		opacity: 0.65;
		border-color: var(--color-neutral-600, #4b5563);
		box-shadow: none;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.card-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-neutral-300, #d1d5db);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Archive button */
	.archive-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.5rem;
		border-radius: 5px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.7rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, color 0.15s, border-color 0.15s;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.archive-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-neutral-300, #d1d5db);
		border-color: var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	.archive-btn--active {
		color: var(--color-success, #10b981);
	}

	.archive-btn--active:hover {
		color: var(--color-success, #10b981);
		border-color: var(--color-success, #10b981);
	}

	/* Maturity section */
	.card-maturity {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.maturity-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.maturity-text {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-neutral-500, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.maturity-pct {
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1;
		transition: color 0.2s;
	}

	/* Override MaturityBar background inside card since card already has surface bg */
	.card-maturity :global(.maturity) {
		background: transparent;
		padding: 0;
	}

	/* Footer */
	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		padding-top: 0.75rem;
	}

	.card-footer time {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
	}

	@media (max-width: 768px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
