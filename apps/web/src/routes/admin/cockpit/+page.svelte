<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { CockpitInterview, CockpitDetail } from '$lib/server/admin-cockpit';

	let { data } = $props();

	let interviews = $state<CockpitInterview[]>(data.interviews);
	let search = $state('');
	let statusFilter = $state('');
	let selectedId = $state<string | null>(null);
	let detail = $state<CockpitDetail | null>(null);
	let loadingDetail = $state(false);
	let showRawState = $state(false);
	let loadingMoreMessages = $state(false);
	let messagesOffset = $state(20);

	async function getToken() {
		return (await auth.currentUser?.getIdToken(false)) ?? '';
	}

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

	async function selectInterview(id: string) {
		if (selectedId === id) return;
		selectedId = id;
		detail = null;
		showRawState = false;
		messagesOffset = 20;
		loadingDetail = true;
		try {
			const token = await getToken();
			const res = await fetch(`/api/admin/cockpit/interviews/${id}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) detail = await res.json();
		} finally {
			loadingDetail = false;
		}
	}

	async function loadMoreMessages() {
		if (!selectedId || !detail) return;
		loadingMoreMessages = true;
		try {
			const token = await getToken();
			const res = await fetch(
				`/api/admin/cockpit/interviews/${selectedId}/messages?offset=${messagesOffset}&limit=20`,
				{ headers: token ? { Authorization: `Bearer ${token}` } : {} }
			);
			if (res.ok) {
				const data = await res.json();
				detail = {
					...detail,
					messages: [...data.messages, ...detail.messages],
				};
				messagesOffset += data.messages.length;
			}
		} finally {
			loadingMoreMessages = false;
		}
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	function maturityColor(m: number) {
		if (m >= 0.7) return 'var(--color-success, #10b981)';
		if (m >= 0.4) return 'var(--color-warning, #f59e0b)';
		return 'var(--color-error, #ef4444)';
	}

	function statusBadgeClass(status: string) {
		switch (status) {
			case 'completed':
			case 'approved':
				return 'badge-success';
			case 'estimating':
			case 'in_progress':
				return 'badge-info';
			case 'failed':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}

	const statuses = $derived([...new Set(interviews.map((i) => i.status))].sort());
</script>

<svelte:head>
	<title>Cockpit — oute.pro</title>
</svelte:head>

<div class="page">
	<nav class="admin-nav">
		<a href="/admin/cockpit" class="nav-tab active">Cockpit</a>
		<a href="/admin" class="nav-tab">Usuários</a>
		<a href="/admin/knowledge" class="nav-tab">Base de Conhecimento</a>
		<a href="/admin/agents" class="nav-tab">Agentes</a>
	</nav>

	<div class="cockpit">
		<!-- Left panel: interview list -->
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
					{#each statuses as s}
						<option value={s}>{s}</option>
					{/each}
				</select>
			</div>

			<div class="list-count">{filtered.length} entrevista{filtered.length !== 1 ? 's' : ''}</div>

			<div class="list-items">
				{#each filtered as iv (iv.id)}
					<button
						class="list-item"
						class:selected={selectedId === iv.id}
						onclick={() => selectInterview(iv.id)}
					>
						<div class="item-top">
							<span class="item-title">{iv.title ?? 'Sem título'}</span>
							<span class="badge {statusBadgeClass(iv.status)}">{iv.status}</span>
						</div>
						<div class="item-meta">
							<span>{iv.user_email}</span>
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

		<!-- Right panel: detail -->
		<div class="detail-panel">
			{#if !selectedId}
				<div class="detail-empty">Selecione uma entrevista para ver os detalhes.</div>
			{:else if loadingDetail}
				<div class="detail-empty">Carregando…</div>
			{:else if detail}
				{@const iv = detail.interview}

				<!-- Header -->
				<div class="detail-header">
					<div>
						<h2 class="detail-title">{iv.title ?? 'Sem título'}</h2>
						<div class="detail-sub">
							<span class="badge {statusBadgeClass(iv.status)}">{iv.status}</span>
							<span class="muted">criado em {fmtDate(iv.created_at)}</span>
							<span class="muted">atualizado em {fmtDate(iv.updated_at)}</span>
						</div>
					</div>
					<div class="maturity-block">
						<div
							class="maturity-pct"
							style="color:{maturityColor(iv.maturity ?? 0)}"
						>
							{Math.round((iv.maturity ?? 0) * 100)}%
						</div>
						<div class="muted" style="font-size:0.75rem">maturidade</div>
					</div>
				</div>

				<!-- Info grid -->
				<div class="info-grid">
					<div class="info-card">
						<div class="info-label">Usuário</div>
						<div class="info-value">{iv.user_id}</div>
					</div>
					<div class="info-card">
						<div class="info-label">Tipo de Projeto</div>
						<div class="info-value">{iv.state?.project_type ?? '—'}</div>
					</div>
					<div class="info-card">
						<div class="info-label">Documentos</div>
						<div class="info-value">{detail.documents.length}</div>
					</div>
					<div class="info-card">
						<div class="info-label">Mensagens</div>
						<div class="info-value">{detail.messageTotal}</div>
					</div>
					<div class="info-card">
						<div class="info-label">Vetores</div>
						<div class="info-value">{detail.knowledgeVectors.length}</div>
					</div>
					{#if detail.estimate}
						<div class="info-card">
							<div class="info-label">Estimativa</div>
							<div class="info-value">
								<span class="badge {statusBadgeClass(detail.estimate.status)}"
									>{detail.estimate.status}</span
								>
							</div>
						</div>
					{/if}
					{#if detail.project}
						<div class="info-card">
							<div class="info-label">Projeto</div>
							<div class="info-value">{detail.project.name ?? detail.project.id}</div>
						</div>
					{/if}
				</div>

				<!-- Domain maturity -->
				{#if iv.state?.domains}
					<div class="section">
						<div class="section-title">Domínios</div>
						<div class="domains">
							{#each Object.entries(iv.state.domains) as [domain, d]}
								{@const dom = d as { answered: number; total: number; vital_answered: boolean }}
								<div class="domain-row">
									<span class="domain-name">{domain}</span>
									<div class="domain-bar-wrap">
										<div
											class="domain-bar-fill"
											style="width:{dom.total ? Math.round((dom.answered / dom.total) * 100) : 0}%"
										></div>
									</div>
									<span class="domain-count muted">{dom.answered}/{dom.total}</span>
									{#if dom.vital_answered}
										<span class="vital-ok">✓</span>
									{:else}
										<span class="vital-no">✗</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Documents -->
				{#if detail.documents.length > 0}
					<div class="section">
						<div class="section-title">Documentos</div>
						<div class="docs-list">
							{#each detail.documents as doc}
								<div class="doc-row">
									<span class="doc-name">{doc.original_name ?? doc.file_path}</span>
									<span class="muted" style="font-size:0.75rem">{doc.file_type ?? ''}</span>
									<span class="muted" style="font-size:0.75rem">{fmtDate(doc.created_at)}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Messages timeline -->
				<div class="section">
					<div class="section-title">
						Conversa
						<span class="muted" style="font-weight:400;font-size:0.8rem"
							>({detail.messageTotal} mensagens)</span
						>
					</div>

					{#if detail.messageTotal > detail.messages.length}
						<button
							class="load-more-btn"
							disabled={loadingMoreMessages}
							onclick={loadMoreMessages}
						>
							{loadingMoreMessages ? 'Carregando…' : `↑ Carregar mensagens anteriores`}
						</button>
					{/if}

					<div class="messages">
						{#each detail.messages as msg}
							<div class="msg" class:msg-user={msg.role === 'user'} class:msg-ai={msg.role !== 'user'}>
								<div class="msg-role">{msg.role === 'user' ? 'Usuário' : 'IA'}</div>
								<div class="msg-text">{msg.content}</div>
								<div class="msg-time muted">{fmtDate(msg.created_at)}</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Raw state -->
				<div class="section">
					<button class="toggle-raw" onclick={() => (showRawState = !showRawState)}>
						{showRawState ? '▾' : '▸'} State JSON
					</button>
					{#if showRawState}
						<pre class="raw-json">{JSON.stringify(iv.state, null, 2)}</pre>
					{/if}
				</div>
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

	.admin-nav {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
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

	.cockpit {
		display: grid;
		grid-template-columns: 360px 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	/* ── List panel ─────────────────────────────────── */

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

	/* ── Detail panel ───────────────────────────────── */

	.detail-panel {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.5rem;
		overflow-y: auto;
		max-height: calc(100vh - 8rem);
	}

	.detail-empty {
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
		text-align: center;
		padding: 3rem 0;
	}

	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.25rem;
	}

	.detail-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0 0 0.4rem;
	}

	.detail-sub {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.maturity-block {
		text-align: center;
		min-width: 60px;
	}

	.maturity-pct {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.info-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.info-label {
		font-size: 0.7rem;
		color: var(--color-neutral-500, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.3rem;
	}

	.info-value {
		font-size: 0.875rem;
		color: #f9fafb;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.section {
		margin-bottom: 1.5rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.75rem;
	}

	/* domains */
	.domains {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.domain-row {
		display: grid;
		grid-template-columns: 100px 1fr 50px 20px;
		align-items: center;
		gap: 0.5rem;
	}

	.domain-name {
		font-size: 0.8rem;
		color: #d1d5db;
	}

	.domain-bar-wrap {
		height: 6px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 3px;
		overflow: hidden;
	}

	.domain-bar-fill {
		height: 100%;
		background: var(--color-primary-500, #6366f1);
		border-radius: 3px;
	}

	.domain-count {
		font-size: 0.75rem;
		text-align: right;
	}

	.vital-ok {
		color: var(--color-success, #10b981);
		font-size: 0.75rem;
	}

	.vital-no {
		color: var(--color-error, #ef4444);
		font-size: 0.75rem;
	}

	/* docs */
	.docs-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.doc-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: #d1d5db;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
	}

	.doc-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* messages */
	.load-more-btn {
		width: 100%;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.8125rem;
		padding: 0.4rem;
		cursor: pointer;
		margin-bottom: 0.75rem;
		transition: background 0.15s;
	}

	.load-more-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.07);
	}

	.load-more-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.messages {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.msg {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		max-width: 88%;
	}

	.msg-user {
		align-self: flex-end;
		align-items: flex-end;
	}

	.msg-ai {
		align-self: flex-start;
		align-items: flex-start;
	}

	.msg-role {
		font-size: 0.7rem;
		color: var(--color-neutral-500, #6b7280);
		font-weight: 500;
	}

	.msg-text {
		font-size: 0.8125rem;
		color: #e5e7eb;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		white-space: pre-wrap;
		line-height: 1.5;
	}

	.msg-user .msg-text {
		background: rgba(99, 102, 241, 0.15);
	}

	.msg-time {
		font-size: 0.65rem;
	}

	/* raw state */
	.toggle-raw {
		background: none;
		border: none;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
		margin-bottom: 0.5rem;
	}

	.toggle-raw:hover {
		color: #d1d5db;
	}

	.raw-json {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 1rem;
		font-size: 0.75rem;
		color: #a5f3fc;
		overflow-x: auto;
		white-space: pre;
		line-height: 1.5;
		max-height: 400px;
		overflow-y: auto;
	}

	/* badges */
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

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}
</style>
