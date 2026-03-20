<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import { Button, SectionHeader, StatusBadge, MaturityBar } from '@oute/ui';

	let { data } = $props();
	let creating = $state(false);

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

	function formatDate(date: string | Date): string {
		return new Date(date).toLocaleDateString('pt-BR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		});
	}
</script>

<svelte:head>
	<title>Entrevistas — oute.pro</title>
</svelte:head>

<div class="page">
	<SectionHeader title="Minhas Entrevistas">
		<Button onclick={createInterview} disabled={creating}>
			{creating ? 'Criando...' : 'Nova Entrevista'}
		</Button>
	</SectionHeader>

	{#if data.interviews.length === 0}
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
		<div class="grid">
			{#each data.interviews as interview (interview.id)}
				<a href={resolveRoute('/interviews/[id]', { id: interview.id })} class="card">
					<div class="card-header">
						<h3 class="card-title">{interview.title || 'Sem título'}</h3>
						<StatusBadge status={interview.status} size="sm" />
					</div>

					<div class="card-maturity">
						<MaturityBar
							maturity={interview.maturity}
							domains={interview.state.domains}
						/>
					</div>

					<div class="card-footer">
						<time datetime={new Date(interview.created_at).toISOString()}>
							{formatDate(interview.created_at)}
						</time>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
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
		transition: border-color 0.2s, background-color 0.2s;
	}

	.card:hover {
		border-color: var(--color-primary-500, #6366f1);
		background-color: var(--color-dark-sidebar, #2a2d3a);
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

	.card-maturity {
		flex: 1;
	}

	/* Override MaturityBar background inside card since card already has surface bg */
	.card-maturity :global(.maturity) {
		background: transparent;
		padding: 0;
	}

	.card-footer {
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
