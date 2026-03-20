<script lang="ts">
	import { page } from '$app/stores';

	const tabs = [
		{ label: 'Cockpit', href: '/admin/cockpit' },
		{ label: 'Usuários', href: '/admin/usuarios' },
		{ label: 'Base de Conhecimento', href: '/admin/knowledge' },
		{ label: 'Agentes', href: '/admin/agents' },
	];

	let { children } = $props();
</script>

<div class="admin-shell">
	<nav class="tab-nav">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class="tab"
				class:active={$page.url.pathname.startsWith(tab.href)}
			>
				{tab.label}
			</a>
		{/each}
	</nav>

	<div class="admin-content">
		{@render children()}
	</div>
</div>

<style>
	.admin-shell {
		min-height: 100vh;
		background: var(--color-dark-bg, #0f1117);
	}

	.tab-nav {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		padding: 0 1.5rem;
		background: var(--color-dark-surface, #1a1d27);
	}

	.tab {
		padding: 1rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-400, #9ca3af);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition:
			color 0.15s,
			border-color 0.15s;
		white-space: nowrap;
	}

	.tab:hover {
		color: var(--color-neutral-200, #e5e7eb);
	}

	.tab.active {
		color: var(--color-primary-400, #818cf8);
		border-bottom-color: var(--color-primary-500, #6366f1);
	}

	.admin-content {
		width: 100%;
	}
</style>
