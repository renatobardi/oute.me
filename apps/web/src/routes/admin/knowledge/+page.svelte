<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { AdminKnowledge } from '$lib/server/admin-knowledge';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let entries = $state<AdminKnowledge[]>(data.entries);
	let loading = $state(false);
	let activeTab = $state<'note' | 'url' | 'document'>('note');
	let search = $state('');
	let typeFilter = $state('');
	let selectedId = $state<string | null>(null);

	// Form fields
	let title = $state('');
	let noteContent = $state('');
	let urlValue = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);

	const filtered = $derived(
		entries.filter((e) => {
			const q = search.toLowerCase();
			const matchSearch = !q || e.title.toLowerCase().includes(q);
			const matchType = !typeFilter || e.type === typeFilter;
			return matchSearch && matchType;
		})
	);

	const selected = $derived(entries.find((e) => e.id === selectedId) ?? null);

	async function getHeaders() {
		const token = await auth.currentUser?.getIdToken(false);
		return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
	}

	async function addNote() {
		if (!title || !noteContent) return;
		loading = true;
		try {
			const headers = await getHeaders();
			const res = await fetch('/api/admin/knowledge', {
				method: 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'note', title, content: noteContent }),
			});
			if (res.ok) {
				const entry = await res.json();
				entries = [entry, ...entries];
				title = '';
				noteContent = '';
			}
		} finally {
			loading = false;
		}
	}

	async function addUrl() {
		if (!title || !urlValue) return;
		loading = true;
		try {
			const headers = await getHeaders();
			const res = await fetch('/api/admin/knowledge', {
				method: 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'url', title, content: urlValue, original_url: urlValue }),
			});
			if (res.ok) {
				const entry = await res.json();
				entries = [entry, ...entries];
				title = '';
				urlValue = '';
			}
		} finally {
			loading = false;
		}
	}

	async function uploadDocument() {
		const file = fileInput?.files?.[0];
		if (!file || !title) return;
		loading = true;
		try {
			const headers = await getHeaders();
			const formData = new FormData();
			formData.append('file', file);
			formData.append('title', title);
			const res = await fetch('/api/admin/knowledge/upload', {
				method: 'POST',
				headers,
				body: formData,
			});
			if (res.ok) {
				const entry = await res.json();
				entries = [entry, ...entries];
				title = '';
				if (fileInput) fileInput.value = '';
			}
		} finally {
			loading = false;
		}
	}

	async function deleteEntry(id: string) {
		const headers = await getHeaders();
		const res = await fetch(`/api/admin/knowledge/${id}`, { method: 'DELETE', headers });
		if (res.ok) {
			entries = entries.filter((e) => e.id !== id);
			if (selectedId === id) selectedId = null;
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('pt-BR');
	}

	function typeBadge(type: string) {
		const map: Record<string, { text: string; cls: string }> = {
			note: { text: 'Nota', cls: 'type-note' },
			url: { text: 'URL', cls: 'type-url' },
			document: { text: 'Documento', cls: 'type-doc' },
		};
		return map[type] ?? { text: type, cls: '' };
	}
</script>

<svelte:head>
	<title>Base de Conhecimento — Admin</title>
</svelte:head>

<div class="page">
	<div class="split">
		<!-- Left: list -->
		<div class="list-panel">
			<div class="list-toolbar">
				<input
					class="search-input"
					type="text"
					placeholder="Buscar por título…"
					bind:value={search}
				/>
				<select class="type-select" bind:value={typeFilter}>
					<option value="">Todos</option>
					<option value="note">Nota</option>
					<option value="url">URL</option>
					<option value="document">Documento</option>
				</select>
			</div>

			<div class="list-count">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</div>

			<div class="list-items">
				{#each filtered as entry (entry.id)}
					{@const badge = typeBadge(entry.type)}
					<button
						class="list-item"
						class:selected={selectedId === entry.id}
						onclick={() => (selectedId = entry.id)}
					>
						<div class="item-top">
							<span class="item-title">{entry.title}</span>
							<span class="badge {badge.cls}">{badge.text}</span>
						</div>
						<div class="item-meta">
							<span>{formatDate(entry.created_at)}</span>
							{#if entry.is_embedded}
								<span class="badge embedded-badge">embedded</span>
							{/if}
						</div>
					</button>
				{/each}

				{#if filtered.length === 0}
					<div class="empty">Nenhum registro encontrado.</div>
				{/if}
			</div>
		</div>

		<!-- Right: add form + detail -->
		<div class="detail-panel">
			<!-- Add form always visible at top -->
			<div class="add-section">
				<div class="add-tabs">
					<button class="add-tab" class:active={activeTab === 'note'} onclick={() => (activeTab = 'note')}>Nota</button>
					<button class="add-tab" class:active={activeTab === 'url'} onclick={() => (activeTab = 'url')}>URL</button>
					<button class="add-tab" class:active={activeTab === 'document'} onclick={() => (activeTab = 'document')}>Documento</button>
				</div>

				<div class="add-form">
					<input type="text" bind:value={title} placeholder="Título" class="input" />

					{#if activeTab === 'note'}
						<textarea bind:value={noteContent} placeholder="Conteúdo da nota…" class="textarea"></textarea>
						<button class="btn-primary" onclick={addNote} disabled={loading || !title || !noteContent}>
							{loading ? 'Salvando…' : 'Adicionar Nota'}
						</button>
					{:else if activeTab === 'url'}
						<input type="url" bind:value={urlValue} placeholder="https://…" class="input" />
						<button class="btn-primary" onclick={addUrl} disabled={loading || !title || !urlValue}>
							{loading ? 'Processando…' : 'Adicionar URL'}
						</button>
					{:else}
						<input type="file" bind:this={fileInput} class="input" />
						<button class="btn-primary" onclick={uploadDocument} disabled={loading || !title}>
							{loading ? 'Enviando…' : 'Upload Documento'}
						</button>
					{/if}
				</div>
			</div>

			<!-- Entry detail -->
			{#if selected}
				{@const badge = typeBadge(selected.type)}
				<div class="entry-detail">
					<div class="entry-header">
						<h2 class="entry-title">{selected.title}</h2>
						<span class="badge {badge.cls}">{badge.text}</span>
					</div>

					<div class="info-grid">
						<div class="info-card">
							<div class="info-label">Data</div>
							<div class="info-value">{formatDate(selected.created_at)}</div>
						</div>
						<div class="info-card">
							<div class="info-label">Embedded</div>
							<div class="info-value">{selected.is_embedded ? 'Sim' : 'Não'}</div>
						</div>
						{#if selected.original_url}
							<div class="info-card" style="grid-column: span 2">
								<div class="info-label">URL</div>
								<div class="info-value url-val">{selected.original_url}</div>
							</div>
						{/if}
					</div>

					{#if selected.content}
						<div class="content-preview">
							<div class="section-label">Conteúdo</div>
							<pre class="content-text">{selected.content.slice(0, 800)}{selected.content.length > 800 ? '…' : ''}</pre>
						</div>
					{/if}

					<div class="entry-actions">
						<button class="btn-delete" onclick={() => deleteEntry(selected.id)}>Excluir entrada</button>
					</div>
				</div>
			{:else}
				<div class="detail-hint">Selecione um registro para ver os detalhes.</div>
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

	.type-select {
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
	}

	.embedded-badge {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.65rem;
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
		max-height: calc(100vh - 8rem);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Add section */

	.add-section {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 1rem;
	}

	.add-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.add-tab {
		padding: 0.35rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.add-tab.active {
		background: var(--color-primary-500, #6366f1);
		color: #fff;
		border-color: var(--color-primary-500, #6366f1);
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.input {
		padding: 0.45rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: var(--color-dark-bg, #0f1117);
		color: #f9fafb;
		font-size: 0.875rem;
		width: 100%;
		box-sizing: border-box;
	}

	.textarea {
		padding: 0.45rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: var(--color-dark-bg, #0f1117);
		color: #f9fafb;
		font-size: 0.875rem;
		min-height: 80px;
		resize: vertical;
		font-family: inherit;
		width: 100%;
		box-sizing: border-box;
	}

	.btn-primary {
		align-self: flex-start;
		padding: 0.45rem 1rem;
		border-radius: 6px;
		border: none;
		background: var(--color-primary-600, #4f46e5);
		color: #fff;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Entry detail */

	.entry-detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.entry-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.entry-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.6rem;
	}

	.info-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
	}

	.info-label {
		font-size: 0.7rem;
		color: var(--color-neutral-500, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}

	.info-value {
		font-size: 0.875rem;
		color: #f9fafb;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.url-val {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--color-neutral-400, #9ca3af);
	}

	.content-preview {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.section-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.content-text {
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		padding: 0.75rem;
		font-size: 0.8125rem;
		color: #d1d5db;
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.5;
		max-height: 240px;
		overflow-y: auto;
		margin: 0;
		font-family: inherit;
	}

	.entry-actions {
		display: flex;
		gap: 0.75rem;
	}

	.btn-delete {
		padding: 0.45rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--color-error, #ef4444);
		color: var(--color-error, #ef4444);
		background: color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.btn-delete:hover {
		background: color-mix(in srgb, var(--color-error, #ef4444) 20%, transparent);
	}

	.detail-hint {
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
		text-align: center;
		padding: 1rem 0;
	}

	/* ── Badges ── */

	.badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.type-note {
		background: color-mix(in srgb, var(--color-primary-500, #6366f1) 15%, transparent);
		color: var(--color-primary-500, #6366f1);
	}

	.type-url {
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent);
		color: var(--color-warning, #f59e0b);
	}

	.type-doc {
		background: color-mix(in srgb, var(--color-success, #10b981) 15%, transparent);
		color: var(--color-success, #10b981);
	}
</style>
