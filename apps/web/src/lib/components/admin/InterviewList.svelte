<script lang="ts">
	import type { CockpitInterview } from '$lib/server/admin-cockpit';
	import { scrollShadow } from '$lib/actions/scroll-shadow';
	import { fmtDate, maturityColor, statusBadgeClass } from '$lib/utils/admin';

	let {
		interviews,
		selectedId,
		onselect,
	}: {
		interviews: CockpitInterview[];
		selectedId: string | null;
		onselect: (id: string) => void;
	} = $props();

	let search = $state('');
	let statusFilter = $state('active');

	const filtered = $derived(
		interviews.filter((iv) => {
			const q = search.toLowerCase();
			const matchSearch =
				!q ||
				(iv.title ?? '').toLowerCase().includes(q) ||
				iv.user_email.toLowerCase().includes(q) ||
				(iv.user_name ?? '').toLowerCase().includes(q);
			const matchStatus = !statusFilter || iv.status === statusFilter;
			return matchSearch && matchStatus;
		})
	);
</script>

<div class="list-panel">
	<div class="list-toolbar">
		<input
			class="search-input"
			type="text"
			placeholder="Buscar por título, e-mail ou nome…"
			bind:value={search}
		/>
		<select class="status-select" bind:value={statusFilter}>
			<option value="">Todos</option>
			<option value="active">Ativos</option>
			<option value="archived">Arquivados</option>
		</select>
	</div>

	<div class="list-count">{filtered.length} entrevista{filtered.length !== 1 ? 's' : ''}</div>

	<div class="list-items" use:scrollShadow>
		{#each filtered as iv (iv.id)}
			<button
				class="list-item"
				class:selected={selectedId === iv.id}
				onclick={() => onselect(iv.id)}
			>
				<div class="item-top">
					<span class="item-title">{iv.title ?? 'Sem título'}</span>
					<span class="badge {statusBadgeClass(iv.status)}">{iv.status}</span>
				</div>
				<div class="item-meta">
					<span>{iv.user_name ?? iv.user_email}</span>
					{#if iv.estimate_id}
						<span class="badge badge-info" style="font-size:0.65rem">est</span>
					{/if}
					{#if iv.project_id}
						<span class="badge badge-success" style="font-size:0.65rem">proj</span>
					{/if}
				</div>
				<div class="item-bar">
					<div
						class="maturity-fill"
						style="width:{Math.round(iv.maturity * 100)}%; background:{maturityColor(iv.maturity)}"
					></div>
				</div>
				<div class="item-date">{fmtDate(iv.updated_at)}</div>
			</button>
		{/each}

		{#if filtered.length === 0}
			<div class="empty">Nenhuma entrevista encontrada.</div>
		{/if}
	</div>
</div>

<style>
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
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.search-input {
		flex: 1;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #f9fafb;
		font-size: 0.8125rem;
		padding: 0.4rem 0.6rem;
		outline: none;
	}

	.search-input:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	.status-select {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #d1d5db;
		font-size: 0.8125rem;
		padding: 0.4rem 0.5rem;
		outline: none;
		cursor: pointer;
	}

	.list-count {
		padding: 0.4rem 0.75rem;
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.list-items {
		overflow-y: auto;
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
		margin-bottom: 0.25rem;
	}

	.item-title {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #f9fafb;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.item-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.4rem;
		overflow: hidden;
		white-space: nowrap;
	}

	.item-bar {
		height: 3px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		margin-bottom: 0.25rem;
		overflow: hidden;
	}

	.maturity-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s;
	}

	.item-date {
		font-size: 0.7rem;
		color: var(--color-neutral-600, #4b5563);
	}

	.empty {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
	}

	.badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.badge-success {
		background: color-mix(in srgb, var(--color-success, #10b981) 15%, transparent);
		color: var(--color-success, #10b981);
	}

	.badge-info {
		background: color-mix(in srgb, #60a5fa 15%, transparent);
		color: #60a5fa;
	}

	.badge-error {
		background: color-mix(in srgb, var(--color-error, #ef4444) 15%, transparent);
		color: var(--color-error, #ef4444);
	}

	.badge-neutral {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-neutral-500, #6b7280);
	}

	.badge-warning {
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent);
		color: var(--color-warning, #f59e0b);
	}
</style>
