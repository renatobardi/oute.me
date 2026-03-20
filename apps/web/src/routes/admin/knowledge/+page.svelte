<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { AdminKnowledge } from '$lib/server/admin-knowledge';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let entries = $state<AdminKnowledge[]>(data.entries);
	let loading = $state(false);
	let activeTab = $state<'note' | 'url' | 'document'>('note');

	// Form fields
	let title = $state('');
	let noteContent = $state('');
	let urlValue = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);

	async function getHeaders() {
		const token = await auth.currentUser?.getIdToken(false);
		return {
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		};
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
			// First extract text from URL via AI service
			const extractRes = await fetch('/api/admin/knowledge', {
				method: 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'url', title, content: urlValue, original_url: urlValue }),
			});
			if (extractRes.ok) {
				const entry = await extractRes.json();
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
		const res = await fetch(`/api/admin/knowledge/${id}`, {
			method: 'DELETE',
			headers,
		});
		if (res.ok) {
			entries = entries.filter((e) => e.id !== id);
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
	<div class="header">
		<h1>Base de Conhecimento</h1>
		<span class="count">{entries.length} registro{entries.length !== 1 ? 's' : ''}</span>
	</div>

	<!-- Add form -->
	<div class="add-section">
		<div class="tabs">
			<button class="tab" class:active={activeTab === 'note'} onclick={() => (activeTab = 'note')}
				>Nota</button
			>
			<button class="tab" class:active={activeTab === 'url'} onclick={() => (activeTab = 'url')}
				>URL</button
			>
			<button
				class="tab"
				class:active={activeTab === 'document'}
				onclick={() => (activeTab = 'document')}>Documento</button
			>
		</div>

		<div class="form">
			<input type="text" bind:value={title} placeholder="Titulo" class="input" />

			{#if activeTab === 'note'}
				<textarea bind:value={noteContent} placeholder="Conteudo da nota..." class="textarea"
				></textarea>
				<button class="btn-primary" onclick={addNote} disabled={loading || !title || !noteContent}>
					{loading ? 'Salvando...' : 'Adicionar Nota'}
				</button>
			{:else if activeTab === 'url'}
				<input type="url" bind:value={urlValue} placeholder="https://..." class="input" />
				<button class="btn-primary" onclick={addUrl} disabled={loading || !title || !urlValue}>
					{loading ? 'Processando...' : 'Adicionar URL'}
				</button>
			{:else}
				<input type="file" bind:this={fileInput} class="input" />
				<button class="btn-primary" onclick={uploadDocument} disabled={loading || !title}>
					{loading ? 'Enviando...' : 'Upload Documento'}
				</button>
			{/if}
		</div>
	</div>

	<!-- Entries list -->
	{#if entries.length > 0}
		<div class="table-wrapper">
			<table>
				<thead>
					<tr>
						<th>Titulo</th>
						<th>Tipo</th>
						<th>Embedded</th>
						<th>Data</th>
						<th>Acao</th>
					</tr>
				</thead>
				<tbody>
					{#each entries as entry (entry.id)}
						{@const badge = typeBadge(entry.type)}
						<tr>
							<td class="title-cell">
								{entry.title}
								{#if entry.original_url}
									<span class="url-hint">{entry.original_url}</span>
								{/if}
							</td>
							<td><span class="badge {badge.cls}">{badge.text}</span></td>
							<td>
								<span class="badge {entry.is_embedded ? 'status-active' : 'status-pending'}">
									{entry.is_embedded ? 'Sim' : 'Nao'}
								</span>
							</td>
							<td>{formatDate(entry.created_at)}</td>
							<td>
								<button class="btn-delete" onclick={() => deleteEntry(entry.id)}>Excluir</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="empty">Nenhum registro na base de conhecimento.</p>
	{/if}
</div>

<style>
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

	.add-section {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		border-radius: 10px;
		padding: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.tab {
		padding: 0.4rem 0.75rem;
		border-radius: 6px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.tab.active {
		background: var(--color-primary-500, #6366f1);
		color: #fff;
		border-color: var(--color-primary-500, #6366f1);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.input {
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		background: var(--color-dark-bg, #0f1117);
		color: #f9fafb;
		font-size: 0.875rem;
	}

	.textarea {
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		background: var(--color-dark-bg, #0f1117);
		color: #f9fafb;
		font-size: 0.875rem;
		min-height: 100px;
		resize: vertical;
		font-family: inherit;
	}

	.btn-primary {
		align-self: flex-start;
		padding: 0.5rem 1rem;
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

	.title-cell {
		max-width: 300px;
	}

	.url-hint {
		display: block;
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
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

	.status-active {
		background: color-mix(in srgb, var(--color-success, #10b981) 15%, transparent);
		color: var(--color-success, #10b981);
	}

	.status-pending {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-neutral-500, #6b7280);
	}

	.btn-delete {
		padding: 0.3rem 0.75rem;
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

	.empty {
		color: var(--color-neutral-500, #6b7280);
		text-align: center;
		padding: 2rem;
	}
</style>
