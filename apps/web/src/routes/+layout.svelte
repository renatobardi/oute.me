<script lang="ts">
	import '@oute/ui/theme.css';
	import type { Snippet } from 'svelte';
	import SettingsMenu from '$lib/components/SettingsMenu.svelte';

	interface Props {
		data: { user: { uid: string; email: string | null; displayName: string | null } | null };
		children: Snippet;
	}

	let { data, children }: Props = $props();
</script>

<div class="app">
	<nav class="navbar">
		<a href="/" class="logo">oute.me</a>
		{#if data.user}
			<SettingsMenu userName={data.user.displayName || data.user.email} />
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

	.content {
		flex: 1;
	}
</style>
