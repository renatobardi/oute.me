<script lang="ts">
	import '@oute/ui/theme.css';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import SettingsMenu from '$lib/components/SettingsMenu.svelte';
	import { initRemoteConfig, getConfigValue } from '$lib/firebase';

	interface Props {
		data: {
			user: { uid: string; email: string | null; displayName: string | null } | null;
			isAdmin?: boolean;
		};
		children: Snippet;
	}

	let { data, children }: Props = $props();

	let maintenanceMode = $state(false);

	onMount(async () => {
		await initRemoteConfig();
		maintenanceMode = getConfigValue('maintenance_mode');
	});
</script>

<svelte:head>
	<!-- Open Graph Meta Tags for Social Media Preview -->
	<meta property="og:title" content="Oute.me - Estimativa de Projetos com IA" />
	<meta property="og:description" content="Plataforma inteligente para estimar, arquitetar e validar projetos de software. Utilize IA para tomar decisões técnicas e financeiras com confiança." />
	<meta property="og:url" content="https://oute.me" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="pt_BR" />

	<!-- Twitter Card Meta Tags -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Oute.me - Estimativa de Projetos com IA" />
	<meta name="twitter:description" content="Plataforma inteligente para estimar, arquitetar e validar projetos de software." />
</svelte:head>

<div class="app">
	<nav class="navbar">
		<a href={data.user ? '/interviews' : '/'} class="logo">oute.me</a>
		{#if data.user}
			<SettingsMenu userName={data.user.displayName || data.user.email} isAdmin={data.isAdmin ?? false} />
		{/if}
	</nav>

	{#if maintenanceMode}
		<div class="maintenance-banner">
			🔧 O sistema está temporariamente em manutenção. Voltamos em breve.
		</div>
	{/if}

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

	.maintenance-banner {
		background-color: var(--color-warning, #f59e0b);
		color: #1a1a1a;
		text-align: center;
		padding: 0.625rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
	}
</style>
