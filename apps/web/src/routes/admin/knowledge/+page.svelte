<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { AdminKnowledge } from '$lib/server/admin-knowledge';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let entries = $state<AdminKnowledge[]>(data.entries);
	let search = $state('');
	let typeFilter = $state('');

	// Form state: null = nenhum selecionado, 'new' = criar, AdminKnowledge = editar
	type FormMode = null | 'new' | AdminKnowledge;
	let mode = $state<FormMode>(null);

	// Form fields
	let fTitle = $state('');
	let fType = $state<'note' | 'url' | 'document'>('note');
	let fContent = $state('');
	let fUrl = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);

	// URL verification
	let urlStatus = $state<'idle' | 'checking' | 'ok' | 'fail'>('idle');
	let urlStatusMsg = $state('');
	let urlDebounce: ReturnType<typeof setTimeout> | null = null;

	let saving = $state(false);
	let deleting = $state(false);

	const filtered = $derived(
		entries.filter((e) => {
			const q = search.toLowerCase();
			const matchSearch = !q || e.title.toLowerCase().includes(q);
			const matchType = !typeFilter || e.type === typeFilter;
			return matchSearch && matchType;
		})
	);

	const selectedId = $derived(mode && mode !== 'new' ? (mode as AdminKnowledge).id : null);

	async function getHeaders() {
		const token = await auth.currentUser?.getIdToken(false);
		return { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
	}

	function openNew() {
		mode = 'new';
		fTitle = '';
		fType = 'note';
		fContent = '';
		fUrl = '';
		urlStatus = 'idle';
		if (fileInput) fileInput.value = '';
	}

	function openEdit(entry: AdminKnowledge) {
		mode = entry;
		fTitle = entry.title;
		fType = entry.type as 'note' | 'url' | 'document';
		fContent = entry.content ?? '';
		fUrl = entry.original_url ?? '';
		urlStatus = 'idle';
	}

	function onTypeChange() {
		fContent = '';
		fUrl = '';
		urlStatus = 'idle';
		if (fileInput) fileInput.value = '';
	}

	function onUrlInput() {
		urlStatus = 'idle';
		urlStatusMsg = '';
		if (urlDebounce) clearTimeout(urlDebounce);
		if (!fUrl) return;
		urlDebounce = setTimeout(() => verifyUrl(), 800);
	}

	async function verifyUrl() {
		if (!fUrl) return;
		urlStatus = 'checking';
		try {
			const headers = await getHeaders();
			const res = await fetch('/api/admin/knowledge/verify-url', {
				method: 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: fUrl }),
			});
			const data = await res.json();
			if (data.ok) {
				urlStatus = 'ok';
				urlStatusMsg = `Respondeu com ${data.status}`;
			} else {
				urlStatus = 'fail';
				urlStatusMsg = data.error ?? `Status ${data.status}`;
			}
		} catch {
			urlStatus = 'fail';
			urlStatusMsg = 'Erro ao verificar';
		}
	}

	async function save() {
		if (!fTitle.trim()) return;
		saving = true;
		try {
			const headers = await getHeaders();

			if (mode === 'new') {
				// CREATE
				if (fType === 'document') {
					const file = fileInput?.files?.[0];
					if (!file) return;
					const formData = new FormData();
					formData.append('file', file);
					formData.append('title', fTitle);
					const res = await fetch('/api/admin/knowledge/upload', {
						method: 'POST',
						headers,
						body: formData,
					});
					if (res.ok) {
						const entry: AdminKnowledge = await res.json();
						entries = [entry, ...entries];
						mode = entry;
					}
				} else {
					const content = fType === 'url' ? fUrl : fContent;
					const res = await fetch('/api/admin/knowledge', {
						method: 'POST',
						headers: { ...headers, 'Content-Type': 'application/json' },
						body: JSON.stringify({
							type: fType,
							title: fTitle,
							content,
							original_url: fType === 'url' ? fUrl : undefined,
						}),
					});
					if (res.ok) {
						const entry: AdminKnowledge = await res.json();
						entries = [entry, ...entries];
						mode = entry;
					}
				}
			} else {
				// UPDATE (documents: only title is editable)
				const existing = mode as AdminKnowledge;
				const content = fType === 'url' ? fUrl : fType === 'document' ? existing.content : fContent;
				const res = await fetch(`/api/admin/knowledge/${existing.id}`, {
					method: 'PATCH',
					headers: { ...headers, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: fTitle,
						content,
						original_url: fType === 'url' ? fUrl : null,
					}),
				});
				if (res.ok) {
					const updated: AdminKnowledge = await res.json();
					entries = entries.map((e) => (e.id === updated.id ? updated : e));
					mode = updated;
				}
			}
		} finally {
			saving = false;
		}
	}

	async function deleteEntry() {
		if (mode === 'new' || mode === null) return;
		const entry = mode as AdminKnowledge;
		if (!confirm(`Excluir "${entry.title}"?`)) return;
		deleting = true;
		try {
			const headers = await getHeaders();
			const res = await fetch(`/api/admin/knowledge/${entry.id}`, { method: 'DELETE', headers });
			if (res.ok) {
				entries = entries.filter((e) => e.id !== entry.id);
				mode = null;
			}
		} finally {
			deleting = false;
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

	const isEditing = $derived(mode !== null && mode !== 'new');
	const canSave = $derived(
		!!fTitle.trim() &&
			(fType === 'note' ? !!fContent.trim() : fType === 'url' ? !!fUrl.trim() : true)
	);
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

			<button class="new-btn" onclick={openNew}>+ Nova entrada</button>

			<div class="list-count">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</div>

			<div class="list-items">
				{#each filtered as entry (entry.id)}
					{@const badge = typeBadge(entry.type)}
					<button
						class="list-item"
						class:selected={selectedId === entry.id}
						onclick={() => openEdit(entry)}
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

		<!-- Right: form -->
		<div class="detail-panel">
			{#if mode === null}
				<div class="detail-empty">
					<div class="empty-icon">📚</div>
					<div>Selecione uma entrada ou clique em <strong>+ Nova entrada</strong>.</div>
				</div>
			{:else}
				<div class="form-header">
					<h2 class="form-title">{mode === 'new' ? 'Nova entrada' : 'Editar entrada'}</h2>
					{#if isEditing}
						{@const badge = typeBadge((mode as AdminKnowledge).type)}
						<span class="badge {badge.cls}">{badge.text}</span>
						{#if (mode as AdminKnowledge).is_embedded}
							<span class="badge embedded-badge">embedded</span>
						{/if}
					{/if}
				</div>

				<div class="form-body">
					<!-- Title -->
					<div class="field">
						<label class="field-label" for="f-title">Nome da base</label>
						<input id="f-title" class="input" type="text" placeholder="Ex: Política de preços" bind:value={fTitle} />
					</div>

					<!-- Type selector (only on new) -->
					{#if mode === 'new'}
						<div class="field">
							<label class="field-label">Tipo</label>
							<div class="type-tabs">
								<button
									class="type-tab"
									class:active={fType === 'note'}
									onclick={() => { fType = 'note'; onTypeChange(); }}
								>Nota</button>
								<button
									class="type-tab"
									class:active={fType === 'url'}
									onclick={() => { fType = 'url'; onTypeChange(); }}
								>URL</button>
								<button
									class="type-tab"
									class:active={fType === 'document'}
									onclick={() => { fType = 'document'; onTypeChange(); }}
								>Documento</button>
							</div>
						</div>
					{/if}

					<!-- Type-specific fields -->
					{#if fType === 'note'}
						<div class="field">
							<label class="field-label" for="f-content">Conteúdo da nota</label>
							<textarea
								id="f-content"
								class="textarea"
								placeholder="Escreva o conteúdo da nota…"
								bind:value={fContent}
							></textarea>
						</div>

					{:else if fType === 'url'}
						<div class="field">
							<label class="field-label" for="f-url">URL</label>
							<div class="url-row">
								<input
									id="f-url"
									class="input"
									class:url-ok={urlStatus === 'ok'}
									class:url-fail={urlStatus === 'fail'}
									type="url"
									placeholder="https://…"
									bind:value={fUrl}
									oninput={onUrlInput}
								/>
								<button class="verify-btn" onclick={verifyUrl} disabled={!fUrl || urlStatus === 'checking'}>
									{urlStatus === 'checking' ? '…' : 'Verificar'}
								</button>
							</div>
							{#if urlStatus !== 'idle'}
								<div class="url-feedback" class:feedback-ok={urlStatus === 'ok'} class:feedback-fail={urlStatus === 'fail'} class:feedback-checking={urlStatus === 'checking'}>
									{#if urlStatus === 'checking'}
										Verificando…
									{:else if urlStatus === 'ok'}
										✓ {urlStatusMsg}
									{:else if urlStatus === 'fail'}
										✗ {urlStatusMsg}
									{/if}
								</div>
							{/if}
						</div>

					{:else if fType === 'document'}
						{#if mode === 'new'}
							<div class="field">
								<label class="field-label">Arquivo</label>
								<input
									type="file"
									bind:this={fileInput}
									class="file-input"
									accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif"
								/>
							</div>
						{:else}
							{@const existing = mode as AdminKnowledge}
							<div class="field">
								<label class="field-label">Arquivo atual</label>
								<div class="doc-info-row">
									<span class="doc-filename">{existing.filename ?? '—'}</span>
									{#if existing.mime_type}
										<span class="mime-badge">{existing.mime_type.split('/').pop()}</span>
									{/if}
								</div>
								<div class="field-hint">Para substituir o arquivo, exclua e crie uma nova entrada.</div>
							</div>
						{/if}
					{/if}

					<!-- Actions -->
					<div class="form-actions">
						<button
							class="btn-save"
							onclick={save}
							disabled={saving || !canSave}
						>
							{saving ? 'Salvando…' : mode === 'new' ? 'Salvar' : 'Atualizar'}
						</button>

						{#if isEditing}
							<button
								class="btn-delete"
								onclick={deleteEntry}
								disabled={deleting}
							>
								{deleting ? 'Excluindo…' : 'Excluir'}
							</button>
						{/if}

						<button class="btn-cancel" onclick={() => (mode = null)}>Cancelar</button>
					</div>

					<!-- Content preview (edit mode only) -->
					{#if isEditing && (mode as AdminKnowledge).content}
						<div class="content-preview">
							<div class="section-label">Conteúdo extraído</div>
							<pre class="content-text">{(mode as AdminKnowledge).content.slice(0, 800)}{(mode as AdminKnowledge).content.length > 800 ? '…' : ''}</pre>
						</div>
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

	.new-btn {
		width: 100%;
		background: rgba(99, 102, 241, 0.1);
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		color: var(--color-primary-500, #6366f1);
		font-size: 0.8125rem;
		font-weight: 500;
		padding: 0.6rem 0.75rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}

	.new-btn:hover {
		background: rgba(99, 102, 241, 0.18);
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
	}

	.detail-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 4rem 1rem;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.9rem;
		text-align: center;
	}

	.empty-icon {
		font-size: 2.5rem;
		opacity: 0.4;
	}

	/* ── Form ── */

	.form-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}

	.form-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0;
	}

	.form-body {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.field-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.field-hint {
		font-size: 0.75rem;
		color: var(--color-neutral-600, #4b5563);
		margin-top: 0.2rem;
	}

	.input {
		padding: 0.5rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: var(--color-dark-bg, #0f1117);
		color: #f9fafb;
		font-size: 0.875rem;
		width: 100%;
		box-sizing: border-box;
		outline: none;
		transition: border-color 0.15s;
	}

	.input:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	.input.url-ok {
		border-color: var(--color-success, #10b981);
	}

	.input.url-fail {
		border-color: var(--color-error, #ef4444);
	}

	.textarea {
		padding: 0.5rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: var(--color-dark-bg, #0f1117);
		color: #f9fafb;
		font-size: 0.875rem;
		min-height: 120px;
		resize: vertical;
		font-family: inherit;
		width: 100%;
		box-sizing: border-box;
		outline: none;
		line-height: 1.5;
	}

	.textarea:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	.type-tabs {
		display: flex;
		gap: 0.5rem;
	}

	.type-tab {
		padding: 0.35rem 0.875rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}

	.type-tab:hover {
		border-color: rgba(255, 255, 255, 0.2);
		color: #f9fafb;
	}

	.type-tab.active {
		background: var(--color-primary-600, #4f46e5);
		border-color: var(--color-primary-600, #4f46e5);
		color: #fff;
	}

	/* URL row */
	.url-row {
		display: flex;
		gap: 0.5rem;
	}

	.url-row .input {
		flex: 1;
	}

	.verify-btn {
		padding: 0.5rem 0.875rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: #d1d5db;
		font-size: 0.8125rem;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
	}

	.verify-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.08);
	}

	.verify-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.url-feedback {
		font-size: 0.8rem;
		padding: 0.3rem 0;
	}

	.feedback-ok { color: var(--color-success, #10b981); }
	.feedback-fail { color: var(--color-error, #ef4444); }
	.feedback-checking { color: var(--color-neutral-500, #6b7280); }

	/* File input */
	.file-input {
		font-size: 0.875rem;
		color: #d1d5db;
		cursor: pointer;
	}

	.doc-info-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.doc-filename {
		font-size: 0.875rem;
		color: #f9fafb;
	}

	.mime-badge {
		background: rgba(99, 102, 241, 0.15);
		color: var(--color-primary-500, #6366f1);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	/* Actions */
	.form-actions {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.btn-save {
		padding: 0.5rem 1.25rem;
		border-radius: 6px;
		border: none;
		background: var(--color-primary-600, #4f46e5);
		color: #fff;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-save:hover:not(:disabled) {
		background: var(--color-primary-500, #6366f1);
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-delete {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid var(--color-error, #ef4444);
		color: var(--color-error, #ef4444);
		background: color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent);
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-delete:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-error, #ef4444) 20%, transparent);
	}

	.btn-delete:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-cancel {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-cancel:hover {
		background: rgba(255, 255, 255, 0.05);
		color: #f9fafb;
	}

	/* Content preview */
	.content-preview {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding-top: 1rem;
	}

	.section-label {
		font-size: 0.72rem;
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
