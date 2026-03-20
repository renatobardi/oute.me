<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { DbUser } from '$lib/server/users';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let users = $state<DbUser[]>(data.users);
	let toggling = $state<string | null>(null);

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
</script>

<svelte:head>
	<title>Admin — oute.pro</title>
</svelte:head>

<div class="page">
	<nav class="admin-nav">
		<a href="/admin/cockpit" class="nav-tab">Cockpit</a>
		<a href="/admin" class="nav-tab active">Usuários</a>
		<a href="/admin/knowledge" class="nav-tab">Base de Conhecimento</a>
		<a href="/admin/agents" class="nav-tab">Agentes</a>
	</nav>

	<div class="header">
		<h1>Usuários</h1>
		<span class="count">{users.length} usuário{users.length !== 1 ? 's' : ''}</span>
	</div>

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th>Nome</th>
					<th>E-mail</th>
					<th>Empresa</th>
					<th>Cargo</th>
					<th>Status</th>
					<th>Cadastro</th>
					<th>Ação</th>
				</tr>
			</thead>
			<tbody>
				{#each users as user (user.id)}
					{@const status = statusLabel(user)}
					<tr>
						<td>{user.full_name ?? user.display_name ?? '—'}</td>
						<td class="email">{user.email}</td>
						<td>{user.company ?? '—'}</td>
						<td>{user.role ?? '—'}</td>
						<td><span class="badge {status.cls}">{status.text}</span></td>
						<td>{formatDate(user.created_at)}</td>
						<td>
							{#if user.onboarding_complete && user.email_verified}
								<button
									class="toggle-btn"
									class:activate={!user.active}
									class:deactivate={user.active}
									disabled={toggling === user.id}
									onclick={() => toggleActive(user)}
								>
									{toggling === user.id ? '…' : user.active ? 'Desativar' : 'Ativar'}
								</button>
							{:else}
								<span class="no-action">—</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.admin-nav {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		padding-bottom: 0;
	}

	.nav-tab {
		padding: 0.6rem 1rem;
		color: var(--color-neutral-500, #6b7280);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		border-bottom: 2px solid transparent;
		transition: color 0.15s, border-color 0.15s;
	}

	.nav-tab:hover {
		color: var(--color-neutral-300, #d1d5db);
	}

	.nav-tab.active {
		color: var(--color-primary-500, #6366f1);
		border-bottom-color: var(--color-primary-500, #6366f1);
	}

	.page {
		padding: 2rem 1.5rem;
		max-width: 1100px;
		margin: 0 auto;
	}

	.header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0;
	}

	.count {
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
	}

	.table-wrapper {
		overflow-x: auto;
		border-radius: 10px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	thead {
		background-color: rgba(255, 255, 255, 0.03);
	}

	th {
		text-align: left;
		padding: 0.75rem 1rem;
		color: var(--color-neutral-500, #6b7280);
		font-weight: 500;
		white-space: nowrap;
		border-bottom: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	td {
		padding: 0.75rem 1rem;
		color: var(--color-neutral-300, #d1d5db);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr:hover td {
		background-color: rgba(255, 255, 255, 0.02);
	}

	.email {
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.8125rem;
	}

	.badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
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

	.toggle-btn {
		padding: 0.3rem 0.75rem;
		border-radius: 6px;
		border: 1px solid;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: opacity 0.15s;
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

	.no-action {
		color: var(--color-neutral-600, #4b5563);
	}
</style>
