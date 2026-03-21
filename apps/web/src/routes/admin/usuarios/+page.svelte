<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { DbUser } from '$lib/server/users';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let users = $state<DbUser[]>(data.users);
	let search = $state('');
	let selectedId = $state<string | null>(null);
	let toggling = $state<string | null>(null);

	const filtered = $derived(
		users.filter((u) => {
			const q = search.toLowerCase();
			return (
				!q ||
				(u.full_name ?? u.display_name ?? '').toLowerCase().includes(q) ||
				u.email.toLowerCase().includes(q)
			);
		})
	);

	const selected = $derived(users.find((u) => u.id === selectedId) ?? null);

	async function toggleActive(user: DbUser) {
		toggling = user.id;
		try {
			const token = await auth.currentUser?.getIdToken(false);
			const res = await fetch(`/api/admin/users/${user.id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ active: !user.active }),
			});
			if (res.ok) {
				users = users.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u));
			}
		} finally {
			toggling = null;
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('pt-BR');
	}

	function statusLabel(user: DbUser) {
		if (!user.onboarding_complete) return { text: 'Cadastro incompleto', cls: 'status-pending' };
		if (!user.email_verified) return { text: 'E-mail não verificado', cls: 'status-unverified' };
		if (!user.active) return { text: 'Aguardando ativação', cls: 'status-inactive' };
		return { text: 'Ativo', cls: 'status-active' };
	}

	function statusColor(user: DbUser) {
		if (!user.onboarding_complete || !user.email_verified) return 'rgba(255,255,255,0.08)';
		if (!user.active) return 'var(--color-warning, #f59e0b)';
		return 'var(--color-success, #10b981)';
	}
</script>

<svelte:head>
	<title>Usuários — Admin oute.pro</title>
</svelte:head>

<div class="page">
	<div class="split">
		<!-- Left: list -->
		<div class="list-panel">
			<div class="list-toolbar">
				<input
					class="search-input"
					type="text"
					placeholder="Buscar por nome ou e-mail…"
					bind:value={search}
				/>
			</div>

			<div class="list-count">{filtered.length} usuário{filtered.length !== 1 ? 's' : ''}</div>

			<div class="list-items">
				{#each filtered as user (user.id)}
					{@const status = statusLabel(user)}
					<button
						class="list-item"
						class:selected={selectedId === user.id}
						onclick={() => (selectedId = user.id)}
					>
						<div class="item-top">
							<span class="item-name">{user.full_name ?? user.display_name ?? '—'}</span>
							<span class="badge {status.cls}">{status.text}</span>
						</div>
						<div class="item-email">{user.email}</div>
						<div class="item-bar">
							<div class="item-bar-fill" style="background:{statusColor(user)}"></div>
						</div>
					</button>
				{/each}

				{#if filtered.length === 0}
					<div class="empty">Nenhum usuário encontrado.</div>
				{/if}
			</div>
		</div>

		<!-- Right: detail -->
		<div class="detail-panel">
			{#if !selected}
				<div class="detail-empty">Selecione um usuário para ver os detalhes.</div>
			{:else}
				{@const status = statusLabel(selected)}
				<div class="detail-header">
					<h2 class="detail-name">{selected.full_name ?? selected.display_name ?? '—'}</h2>
					<span class="badge {status.cls}">{status.text}</span>
				</div>

				<div class="info-list">
					<div class="info-row">
						<span class="info-label">E-mail</span>
						<span class="info-value">{selected.email}</span>
					</div>
					<div class="info-row">
						<span class="info-label">Empresa</span>
						<span class="info-value">{selected.company ?? '—'}</span>
					</div>
					<div class="info-row">
						<span class="info-label">Cargo</span>
						<span class="info-value">{selected.role ?? '—'}</span>
					</div>
					<div class="info-row">
						<span class="info-label">Cadastro</span>
						<span class="info-value">{formatDate(selected.created_at)}</span>
					</div>
					<div class="info-row">
						<span class="info-label">E-mail verificado</span>
						<span class="info-value">{selected.email_verified ? 'Sim' : 'Não'}</span>
					</div>
					<div class="info-row">
						<span class="info-label">Onboarding</span>
						<span class="info-value">{selected.onboarding_complete ? 'Completo' : 'Pendente'}</span>
					</div>
				</div>

				{#if selected.onboarding_complete && selected.email_verified}
					<div class="actions">
						<button
							class="toggle-btn"
							class:activate={!selected.active}
							class:deactivate={selected.active}
							disabled={toggling === selected.id}
							onclick={() => toggleActive(selected)}
						>
							{toggling === selected.id ? '…' : selected.active ? 'Desativar usuário' : 'Ativar usuário'}
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.page {
		padding: 2rem 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.split {
		display: grid;
		grid-template-columns: 360px 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	/* ── List panel ── */

	.list-panel {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 8rem);
	}

	.list-toolbar {
		padding: 0.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.search-input {
		width: 100%;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #f9fafb;
		font-size: 0.8125rem;
		padding: 0.4rem 0.6rem;
		outline: none;
		box-sizing: border-box;
	}

	.search-input:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	.list-count {
		padding: 0.4rem 0.75rem;
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.list-items {
		overflow-y: auto;
		background:
			linear-gradient(#1a1d27 30%, transparent) center top / 100% 2.5rem no-repeat local,
			linear-gradient(transparent, #1a1d27 70%) center bottom / 100% 2.5rem no-repeat local,
			radial-gradient(farthest-side at 50% 0, rgba(0,0,0,.25), transparent) center top / 100% 10px no-repeat scroll,
			radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,.25), transparent) center bottom / 100% 10px no-repeat scroll;
		background-color: #1a1d27;
		flex: 1;
	}

	.list-item {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		padding: 0.75rem;
		cursor: pointer;
		transition: background 0.1s;
		color: inherit;
	}

	.list-item:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.list-item.selected {
		background: rgba(99, 102, 241, 0.1);
		border-left: 3px solid var(--color-primary-500, #6366f1);
	}

	.item-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.2rem;
	}

	.item-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #f9fafb;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.item-email {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.4rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-bar {
		height: 3px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		overflow: hidden;
	}

	.item-bar-fill {
		height: 100%;
		width: 100%;
		border-radius: 2px;
	}

	.empty {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
	}

	/* ── Detail panel ── */

	.detail-panel {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.5rem;
		min-height: 300px;
		max-height: calc(100vh - 8rem);
		overflow-y: auto;
		background:
			linear-gradient(#1a1d27 30%, transparent) center top / 100% 2.5rem no-repeat local,
			linear-gradient(transparent, #1a1d27 70%) center bottom / 100% 2.5rem no-repeat local,
			radial-gradient(farthest-side at 50% 0, rgba(0,0,0,.25), transparent) center top / 100% 10px no-repeat scroll,
			radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,.25), transparent) center bottom / 100% 10px no-repeat scroll;
		background-color: #1a1d27;
	}

	.detail-empty {
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
		text-align: center;
		padding: 3rem 0;
	}

	.detail-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.detail-name {
		font-size: 1.25rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0;
	}

	.info-list {
		display: flex;
		flex-direction: column;
		margin-bottom: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		overflow: hidden;
	}

	.info-row {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		padding: 0.65rem 0.875rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.info-row:last-child {
		border-bottom: none;
	}

	.info-label {
		font-size: 0.72rem;
		color: var(--color-neutral-500, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 130px;
		flex-shrink: 0;
	}

	.info-value {
		font-size: 0.875rem;
		color: #f9fafb;
		font-weight: 500;
		word-break: break-all;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
	}

	/* ── Badges ── */

	.badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.status-active {
		background: color-mix(in srgb, var(--color-success, #10b981) 15%, transparent);
		color: var(--color-success, #10b981);
	}

	.status-inactive {
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent);
		color: var(--color-warning, #f59e0b);
	}

	.status-unverified {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-neutral-500, #6b7280);
	}

	.status-pending {
		background: rgba(255, 255, 255, 0.04);
		color: var(--color-neutral-600, #4b5563);
	}

	/* ── Toggle button ── */

	.toggle-btn {
		padding: 0.45rem 1rem;
		border-radius: 6px;
		border: 1px solid;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.toggle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-btn.activate {
		border-color: var(--color-success, #10b981);
		color: var(--color-success, #10b981);
		background: color-mix(in srgb, var(--color-success, #10b981) 10%, transparent);
	}

	.toggle-btn.activate:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-success, #10b981) 20%, transparent);
	}

	.toggle-btn.deactivate {
		border-color: var(--color-error, #ef4444);
		color: var(--color-error, #ef4444);
		background: color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent);
	}

	.toggle-btn.deactivate:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-error, #ef4444) 20%, transparent);
	}
</style>
