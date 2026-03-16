<script lang="ts">
	import '@oute/ui/theme.css';
	import type { Snippet } from 'svelte';

	interface Props {
		data: { user: { uid: string; email: string | null; displayName: string | null } | null };
		children: Snippet;
	}

	let { data, children }: Props = $props();

	function handleLogout() {
		import('$lib/firebase').then(({ auth }) =>
			import('firebase/auth').then(({ signOut }) => {
				signOut(auth).then(() => {
					window.location.href = '/login';
				});
			})
		);
	}
</script>

<div class="app">
	<nav class="navbar">
		<a href="/" class="logo">oute.me</a>
		{#if data.user}
			<button class="logout-btn" onclick={handleLogout}>Sair</button>
		{/if}
	</nav>

	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background-color: var(--color-dark-bg, #0f1117);
		color: #e5e7eb;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.navbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.5rem;
		background-color: var(--color-dark-surface, #1a1d27);
		border-bottom: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	.logo {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-primary-500, #6366f1);
		text-decoration: none;
	}

	.logout-btn {
		background: transparent;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		color: var(--color-neutral-300, #d1d5db);
		padding: 0.375rem 0.75rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background-color 0.2s;
	}

	.logout-btn:hover {
		background-color: rgba(255, 255, 255, 0.05);
	}

	.content {
		flex: 1;
	}
</style>
