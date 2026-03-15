<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import { Button } from '@oute/ui';

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
</script>

<svelte:head>
	<title>Entrevistas — oute.me</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<h1>Entrevistas</h1>
		<Button onclick={createInterview} disabled={creating}>
			{creating ? 'Criando...' : 'Nova Entrevista'}
		</Button>
	</header>

	{#if data.interviews.length === 0}
		<div class="empty">
			<p>Nenhuma entrevista ainda.</p>
			<p>Crie uma nova entrevista para começar a estimar seu projeto.</p>
		</div>
	{:else}
		<div class="interviews-list">
			{#each data.interviews as interview (interview.id)}
				<a href={resolveRoute('/interviews/[id]', { id: interview.id })} class="interview-card">
					<div class="interview-info">
						<h3>{interview.title || 'Entrevista sem título'}</h3>
						<span class="interview-status">{interview.status}</span>
					</div>
					<div class="interview-meta">
						<span class="maturity">{Math.round(interview.maturity * 100)}%</span>
						<time>{new Date(interview.created_at).toLocaleDateString('pt-BR')}</time>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		color: var(--color-neutral-300, #d1d5db);
		font-size: 1.5rem;
	}

	.empty {
		text-align: center;
		padding: 4rem 1rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.interviews-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.interview-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		background: var(--color-dark-surface, #1a1d27);
		border-radius: 10px;
		text-decoration: none;
		transition: background 0.2s;
	}

	.interview-card:hover {
		background: var(--color-dark-sidebar, #2a2d3a);
	}

	.interview-info h3 {
		color: var(--color-neutral-300, #d1d5db);
		font-size: 1rem;
		margin: 0 0 0.25rem;
	}

	.interview-status {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		text-transform: capitalize;
	}

	.interview-meta {
		text-align: right;
	}

	.maturity {
		display: block;
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-primary-500, #6366f1);
	}

	time {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
	}
</style>
