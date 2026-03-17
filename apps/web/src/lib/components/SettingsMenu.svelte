<script lang="ts">
	import { auth } from '$lib/firebase';

	interface Tone {
		id: string;
		name: string;
		slug: string;
		action: string;
		is_default: boolean;
	}

	import { goto } from '$app/navigation';
	import { activeTone } from '$lib/stores/tone.svelte';

	interface Props {
		userName: string | null;
		isAdmin?: boolean;
	}

	let { userName, isAdmin = false }: Props = $props();

	let isOpen = $state(false);
	let showTonePanel = $state(false);
	let tones = $state<Tone[]>([]);
	let activeToneId = $state<string | null>(null);
	let loading = $state(false);

	async function getAuthHeaders(): Promise<Record<string, string>> {
		try {
			const token = await auth.currentUser?.getIdToken(true);
			if (!token) return {};
			return { Authorization: `Bearer ${token}` };
		} catch {
			return {};
		}
	}

	let tonesError = $state<string | null>(null);

	async function loadTones() {
		if (tones.length > 0) return;
		loading = true;
		tonesError = null;
		try {
			const headers = await getAuthHeaders();
			const res = await fetch('/api/tones', { headers });
			if (res.redirected || res.status === 302 || res.status === 401) {
				tonesError = 'Sessão expirada. Recarregue a página.';
				return;
			}
			if (res.ok) {
				const data = await res.json();
				tones = data.tones;
				activeToneId = data.active_tone_id;
				if (tones.length === 0) {
					tonesError = 'Nenhum tom disponível.';
				}
			} else {
				tonesError = 'Erro ao carregar tons.';
			}
		} catch {
			tonesError = 'Erro de conexão ao carregar tons.';
		} finally {
			loading = false;
		}
	}

	async function selectTone(toneId: string) {
		const prev = activeToneId;
		activeToneId = toneId;
		try {
			const headers = await getAuthHeaders();
			const res = await fetch('/api/tones/active', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: JSON.stringify({ tone_id: toneId }),
			});
			if (!res.ok) {
				activeToneId = prev;
			} else {
				const tone = tones.find((t) => t.id === toneId);
				if (tone) activeTone.action = tone.action;
			}
		} catch {
			activeToneId = prev;
		}
	}

	function toggle() {
		isOpen = !isOpen;
		if (isOpen) {
			showTonePanel = false;
			loadTones();
		}
	}

	function openTonePanel() {
		showTonePanel = true;
	}

	function backToMenu() {
		showTonePanel = false;
	}

	function closeMenu() {
		isOpen = false;
		showTonePanel = false;
	}

	async function handleLogout() {
		const { signOut } = await import('firebase/auth');
		await signOut(auth);
		await fetch('/api/auth/session', { method: 'DELETE' });
		window.location.href = '/login';
	}
</script>

<div class="settings-menu">
	<button class="hamburger-btn" onclick={toggle} aria-label="Menu de configurações">
		{#if isOpen}
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		{/if}
	</button>

	{#if isOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="backdrop" onclick={closeMenu} onkeydown={() => {}}></div>
		<div class="dropdown">
			{#if showTonePanel}
				<!-- TONE PANEL -->
				<div class="panel-header">
					<button class="back-btn" onclick={backToMenu}>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="15 18 9 12 15 6" />
						</svg>
					</button>
					<span class="panel-title">Tom da conversa</span>
				</div>

				{#if loading}
					<div class="loading">Carregando...</div>
				{:else if tonesError}
					<div class="loading">{tonesError}</div>
				{:else}
					<div class="tone-list">
						{#each tones as tone (tone.id)}
							<button
								class="tone-card"
								class:active={activeToneId === tone.id}
								onclick={() => selectTone(tone.id)}
							>
								<div class="tone-header">
									<span class="tone-name">{tone.name}</span>
									<span class="tone-toggle" class:on={activeToneId === tone.id}>
										{activeToneId === tone.id ? 'Ativo' : 'Inativo'}
									</span>
								</div>
								<p class="tone-action">{tone.action.slice(0, 120)}...</p>
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<!-- MAIN MENU -->
				{#if userName}
					<div class="user-info">
						<div class="user-avatar">{userName.charAt(0).toUpperCase()}</div>
						<span class="user-name">{userName}</span>
					</div>
					<div class="menu-divider"></div>
				{/if}

				{#if isAdmin}
					<button class="menu-item admin" onclick={() => { closeMenu(); goto('/admin'); }}>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
						</svg>
						<span>Administração</span>
					</button>
					<div class="menu-divider"></div>
				{/if}

				<button class="menu-item" onclick={openTonePanel}>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 20h9" />
						<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
					</svg>
					<span>Tom da conversa</span>
					<svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</button>

				<div class="menu-divider"></div>

				<button class="menu-item logout" onclick={handleLogout}>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
						<polyline points="16 17 21 12 16 7" />
						<line x1="21" y1="12" x2="9" y2="12" />
					</svg>
					<span>Sair</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.settings-menu {
		position: relative;
	}

	.hamburger-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--color-neutral-300, #d1d5db);
		cursor: pointer;
		transition: background-color 0.2s, border-color 0.2s;
	}

	.hamburger-btn:hover {
		background-color: rgba(255, 255, 255, 0.05);
		border-color: var(--color-primary-500, #6366f1);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		width: 280px;
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		z-index: 50;
		overflow: hidden;
		padding: 0.5rem;
	}

	/* User info */
	.user-info {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem;
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--color-primary-500, #6366f1);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.user-name {
		font-size: 0.875rem;
		color: var(--color-neutral-300, #d1d5db);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.menu-divider {
		height: 1px;
		background: var(--color-dark-border, rgba(255, 255, 255, 0.08));
		margin: 0.25rem 0;
	}

	/* Menu items */
	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.625rem 0.5rem;
		background: none;
		border: none;
		color: var(--color-neutral-300, #d1d5db);
		font-size: 0.875rem;
		cursor: pointer;
		border-radius: 8px;
		transition: background-color 0.15s;
		text-align: left;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.menu-item .chevron {
		margin-left: auto;
		opacity: 0.5;
	}

	.menu-item.admin {
		color: var(--color-primary-500, #6366f1);
	}

	.menu-item.logout {
		color: var(--color-error, #ef4444);
	}

	/* Tone panel */
	.panel-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		background: none;
		color: var(--color-neutral-300, #d1d5db);
		cursor: pointer;
	}

	.back-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.panel-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #f9fafb;
	}

	.loading {
		padding: 1rem;
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.tone-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0 0.25rem 0.25rem;
	}

	.tone-card {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.75rem;
		background: var(--color-dark-bg, #0f1117);
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		color: var(--color-neutral-300, #d1d5db);
		transition: border-color 0.2s;
		width: 100%;
	}

	.tone-card:hover {
		border-color: var(--color-primary-500, #6366f1);
	}

	.tone-card.active {
		border-color: var(--color-primary-500, #6366f1);
		background: color-mix(in srgb, var(--color-primary-500, #6366f1) 8%, var(--color-dark-bg, #0f1117));
	}

	.tone-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.tone-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: #f9fafb;
	}

	.tone-toggle {
		font-size: 0.6875rem;
		font-weight: 500;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		background: var(--color-neutral-700, #374151);
		color: var(--color-neutral-400, #9ca3af);
	}

	.tone-toggle.on {
		background: color-mix(in srgb, var(--color-success, #10b981) 20%, transparent);
		color: var(--color-success, #10b981);
	}

	.tone-action {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		line-height: 1.4;
		margin: 0;
	}
</style>
