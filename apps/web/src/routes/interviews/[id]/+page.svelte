<script lang="ts">
	import { goto } from '$app/navigation';
	import { ChatBubble, MaturityBar, DocumentCard, Button, StatusBadge } from '@oute/ui';
	import { createChatState } from '$lib/stores/chat.svelte';
	import { activeTone } from '$lib/stores/tone.svelte';
	import { MATURITY_THRESHOLD } from '$lib/types/interview';
	import { AGENT_LABELS, AGENT_KEYS } from '$lib/types/estimate';
	import type { AgentStep } from '$lib/types/estimate';

	let { data } = $props();

	// Inicializa o store compartilhado de tom com o valor carregado do servidor
	$effect(() => {
		activeTone.action = data.toneAction ?? null;
	});

	// svelte-ignore state_referenced_locally
	const chat = createChatState(
		data.interview.id,
		data.messages,
		data.interview.maturity,
		data.interview.state.domains,
		data.documents.map((d: { id: string; filename: string; status: string; mime_type: string }) => ({
			id: d.id,
			filename: d.filename,
			status: d.status as 'pending' | 'processing' | 'completed' | 'failed',
			mime_type: d.mime_type,
		})),
		data.interview.title
	);

	let inputText = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);
	let chatContainer = $state<HTMLElement | null>(null);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let isRequestingEstimate = $state(false);
	let existingEstimate = $state(data.existingEstimate ?? null);
	let existingProject = $state(data.existingProject ?? null);

	// Estimate panel state
	let showEstimatePanel = $state(false);
	let panelSteps = $state<AgentStep[]>(data.existingEstimate?.agent_steps ?? []);
	let panelStatus = $state(data.existingEstimate?.status ?? '');
	let panelPollTimer = $state<ReturnType<typeof setInterval> | null>(null);

	async function fetchEstimateSteps() {
		if (!existingEstimate) return;
		try {
			const res = await fetch(`/api/estimates/${existingEstimate.id}`);
			if (!res.ok) return;
			const est = await res.json();
			panelSteps = est.agent_steps ?? [];
			panelStatus = est.status;
			existingEstimate = { ...existingEstimate, status: est.status, agent_steps: est.agent_steps ?? [] };
		} catch { /* ignore */ }
	}

	function openEstimatePanel() {
		showEstimatePanel = true;
		fetchEstimateSteps();
		if (['pending', 'running'].includes(panelStatus)) {
			panelPollTimer = setInterval(fetchEstimateSteps, 5000);
		}
	}

	function closeEstimatePanel() {
		showEstimatePanel = false;
		if (panelPollTimer) { clearInterval(panelPollTimer); panelPollTimer = null; }
	}

	$effect(() => {
		if (!['pending', 'running'].includes(panelStatus) && panelPollTimer) {
			clearInterval(panelPollTimer);
			panelPollTimer = null;
		}
	});

	// Editable title state
	let isTitleEditing = $state(false);
	let titleEditValue = $state('');
	let isTitleHovered = $state(false);

	function startTitleEdit() {
		titleEditValue = chat.title ?? '';
		isTitleEditing = true;
	}

	function cancelTitleEdit() {
		isTitleEditing = false;
	}

	async function saveTitleEdit() {
		const newTitle = titleEditValue.trim();
		if (!newTitle || newTitle === chat.title) {
			isTitleEditing = false;
			return;
		}
		try {
			const res = await fetch(`/api/interviews/${data.interview.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: newTitle }),
			});
			if (res.ok) {
				chat.setTitle(newTitle);
			}
		} catch {
			// silently fail
		}
		isTitleEditing = false;
	}

	function handleTitleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveTitleEdit();
		else if (e.key === 'Escape') cancelTitleEdit();
	}

	let canEstimate = $derived(chat.maturity >= MATURITY_THRESHOLD && !chat.isStreaming);

	const domainLabels: Record<string, string> = {
		scope: 'Escopo',
		timeline: 'Timeline',
		budget: 'Orçamento',
		integrations: 'Integrações',
		tech_stack: 'Tech Stack',
	};

	async function requestEstimate() {
		isRequestingEstimate = true;
		try {
			const res = await fetch('/api/estimates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ interview_id: data.interview.id }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body?.error || `Erro ${res.status}`);
			}
			const result = await res.json();
			existingEstimate = { id: result.id, status: result.status };
			goto(`/estimates/${result.id}`);
		} catch (e) {
			chat.error = `Erro ao solicitar estimativa: ${e instanceof Error ? e.message : 'tente novamente'}`;
			isRequestingEstimate = false;
		}
	}

	$effect(() => {
		if (chatContainer && (chat.messages.length || chat.currentStreamText)) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	});

	$effect(() => {
		if (!chat.isStreaming && textareaRef) {
			textareaRef.focus();
		}
	});

	async function handleSend() {
		const text = inputText.trim();
		if (!text) return;
		inputText = '';
		await chat.sendMessage(text);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	async function handleFileUpload() {
		const file = fileInput?.files?.[0];
		if (!file) return;
		await chat.uploadDocument(file);
		if (fileInput) fileInput.value = '';
	}

	function autoResize(e: Event) {
		const el = e.target as HTMLTextAreaElement;
		el.style.height = 'auto';
		el.style.height = Math.min(el.scrollHeight, 120) + 'px';
	}
</script>

<svelte:head>
	<title>{chat.title || 'Entrevista'} — oute.pro</title>
</svelte:head>

<div class="interview-page">
	<!-- SIDEBAR -->
	<aside class="sidebar">
		<!-- Editable title -->
		{#if isTitleEditing}
			<div class="title-edit">
				<input
					class="title-input"
					bind:value={titleEditValue}
					onkeydown={handleTitleKeydown}
					maxlength={80}
					autofocus
				/>
				<div class="title-edit-actions">
					<button class="title-action-btn confirm" onclick={saveTitleEdit} title="Salvar">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					</button>
					<button class="title-action-btn cancel" onclick={cancelTitleEdit} title="Cancelar">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
						</svg>
					</button>
				</div>
			</div>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="sidebar-title-wrap"
				onmouseenter={() => (isTitleHovered = true)}
				onmouseleave={() => (isTitleHovered = false)}
			>
				<h2 class="sidebar-title">{chat.title || 'Nova Entrevista'}</h2>
				{#if isTitleHovered}
					<button class="title-edit-btn" onclick={startTitleEdit} title="Editar nome">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
						</svg>
					</button>
				{/if}
			</div>
		{/if}

		<div class="sidebar-section">
			<MaturityBar maturity={chat.maturity} domains={chat.domains} />
		</div>

		<div class="sidebar-section">
			<h3 class="sidebar-label">Domínios</h3>
			<ul class="domain-list">
				{#each Object.entries(chat.domains) as [key, domain] (key)}
					{@const progress = domain.total > 0 ? Math.round((domain.answered / domain.total) * 100) : 0}
					<li class="domain-item">
						<div class="domain-header">
							<span class="domain-name">{domainLabels[key] || key}</span>
							<div class="domain-header-right">
								{#if domain.vital_answered}
									<span class="vital-tag">vital</span>
								{/if}
								<span class="domain-count">{domain.answered}/{domain.total}</span>
							</div>
						</div>
						<div class="domain-track">
							<div class="domain-fill" style="width: {progress}%"></div>
						</div>
					</li>
				{/each}
			</ul>
		</div>

		{#if existingProject}
			<div class="sidebar-section estimate-action">
				<a class="estimate-link project-link" href="/projects/{existingProject.id}">
					<span class="estimate-link-label">Ver Projeto</span>
					<span class="project-link-name">{existingProject.name}</span>
				</a>
			</div>
		{/if}

		{#if existingEstimate}
			<div class="sidebar-section estimate-action">
				<button class="estimate-link" onclick={openEstimatePanel}>
					<span class="estimate-link-label">Ver Estimativa</span>
					<span class="estimate-status-badge status-{existingEstimate.status}">{existingEstimate.status}</span>
				</button>
			</div>
		{:else if canEstimate}
			<div class="sidebar-section estimate-action">
				<Button onclick={requestEstimate} disabled={isRequestingEstimate} size="lg">
					{isRequestingEstimate ? 'Solicitando...' : 'Solicitar Estimativa'}
				</Button>
			</div>
		{/if}

		{#if chat.documents.length > 0}
			<div class="sidebar-section">
				<h3 class="sidebar-label">Documentos</h3>
				<div class="documents-list">
					{#each chat.documents as doc (doc.id)}
						<DocumentCard
							filename={doc.filename}
							status={doc.status}
							mimeType={doc.mime_type}
							ondelete={() => chat.deleteDocument(doc.id)}
						/>
					{/each}
				</div>
			</div>
		{/if}
	</aside>

	<!-- CHAT -->
	<main class="chat-area" class:has-panel={showEstimatePanel}>
		<header class="chat-header">
			<h2>Entrevista</h2>
			<StatusBadge status={data.interview.status} size="sm" />
		</header>

		{#if showEstimatePanel && existingEstimate}
			{@const displaySteps = panelSteps.length > 0
				? panelSteps
				: AGENT_KEYS.map((k) => ({ agent_key: k, status: 'pending', started_at: null, finished_at: null, duration_s: null, output_preview: null, error: null }))}
			<div class="estimate-panel">
				<div class="estimate-panel-header">
					<div class="estimate-panel-title">
						<span class="estimate-panel-label">Pipeline de Estimativa</span>
						<span class="estimate-panel-badge status-badge-{panelStatus}">{panelStatus}</span>
						{#if ['pending', 'running'].includes(panelStatus)}
							<span class="panel-spinner"></span>
						{/if}
					</div>
					<div class="estimate-panel-actions">
						<a href="/estimates/{existingEstimate.id}" class="panel-link-btn" target="_blank">Abrir completo ↗</a>
						<button class="panel-close-btn" onclick={closeEstimatePanel} title="Fechar painel">✕</button>
					</div>
				</div>
				<div class="estimate-panel-steps">
					{#each displaySteps as step (step.agent_key)}
						<div class="panel-step panel-step-{step.status}">
							<span class="panel-step-dot">
								{#if step.status === 'done'}✓{:else if step.status === 'failed'}✗{:else if step.status === 'running'}◉{:else}○{/if}
							</span>
							<span class="panel-step-name">{AGENT_LABELS[step.agent_key] ?? step.agent_key}</span>
							{#if step.duration_s}
								<span class="panel-step-dur">{step.duration_s.toFixed(0)}s</span>
							{/if}
							{#if step.error}
								<span class="panel-step-error" title={step.error}>!</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if chat.error}
			<div class="alert alert-error">
				<span>{chat.error}</span>
				<button class="alert-dismiss" onclick={() => (chat.error = null)}>&#xd7;</button>
			</div>
		{/if}

		{#if chat.uploadError}
			<div class="alert alert-error">
				<span>{chat.uploadError}</span>
				<button class="alert-dismiss" onclick={() => (chat.uploadError = null)}>&#xd7;</button>
			</div>
		{/if}

		<div class="messages" bind:this={chatContainer}>
			{#if chat.messages.length === 0 && !chat.isStreaming}
				<div class="empty-chat">
					<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					</svg>
					<p>Descreva seu projeto para iniciar a entrevista.</p>
				</div>
			{/if}

			{#each chat.messages as msg (msg.id)}
				<ChatBubble role={msg.role} content={msg.content} timestamp={msg.timestamp} />
			{/each}

			{#if chat.currentStreamText}
				<div class="streaming-bubble">
					<ChatBubble role="assistant" content={chat.currentStreamText} />
					<span class="cursor"></span>
				</div>
			{:else if chat.isStreaming}
				<div class="typing-indicator">
					<span class="dot"></span>
					<span class="dot"></span>
					<span class="dot"></span>
				</div>
			{/if}
		</div>

		<div class="input-area">
			<input
				type="file"
				bind:this={fileInput}
				onchange={handleFileUpload}
				accept=".pdf,.docx,.xlsx,.csv,.pptx,.png,.jpg,.jpeg,.webp"
				hidden
			/>
			<button
				class="icon-btn"
				onclick={() => fileInput?.click()}
				disabled={chat.isStreaming}
				title="Anexar documento"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
				</svg>
			</button>
			<textarea
				bind:this={textareaRef}
				bind:value={inputText}
				onkeydown={handleKeydown}
				oninput={autoResize}
				placeholder="Descreva seu projeto..."
				rows={1}
				disabled={chat.isStreaming}
			></textarea>
			<Button onclick={handleSend} disabled={chat.isStreaming || !inputText.trim()}>
				Enviar
			</Button>
		</div>
	</main>
</div>

<style>
	/* ── Layout ── */
	.interview-page {
		display: grid;
		grid-template-columns: 280px 1fr;
		height: calc(100vh - 53px);
		background: var(--color-dark-bg, #0f1117);
		color: var(--color-neutral-300, #d1d5db);
	}

	/* ── Sidebar ── */
	.sidebar {
		background: var(--color-dark-surface, #1a1d27);
		border-right: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		padding: 1.25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	/* ── Editable title ── */
	.sidebar-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 1rem;
		min-width: 0;
	}

	.sidebar-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.title-edit-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--color-neutral-500, #6b7280);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}

	.title-edit-btn:hover {
		color: var(--color-primary-500, #6366f1);
		background: rgba(99, 102, 241, 0.1);
	}

	.title-edit {
		margin-bottom: 1rem;
	}

	.title-input {
		width: 100%;
		background: var(--color-dark-bg, #0f1117);
		border: 1px solid var(--color-primary-500, #6366f1);
		border-radius: 6px;
		color: #f9fafb;
		font-size: 1rem;
		font-weight: 700;
		padding: 0.375rem 0.5rem;
		outline: none;
		box-sizing: border-box;
	}

	.title-edit-actions {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.375rem;
		justify-content: flex-end;
	}

	.title-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		transition: background 0.15s;
	}

	.title-action-btn.confirm {
		background: rgba(16, 185, 129, 0.15);
		color: var(--color-success, #10b981);
	}

	.title-action-btn.confirm:hover {
		background: rgba(16, 185, 129, 0.25);
	}

	.title-action-btn.cancel {
		background: rgba(239, 68, 68, 0.15);
		color: var(--color-error, #ef4444);
	}

	.title-action-btn.cancel:hover {
		background: rgba(239, 68, 68, 0.25);
	}

	.sidebar-section {
		padding: 0.75rem 0;
		border-top: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	.sidebar-section:first-of-type {
		border-top: none;
		padding-top: 0;
	}

	.sidebar-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-neutral-500, #6b7280);
		margin: 0 0 0.75rem;
	}

	/* Override MaturityBar background inside sidebar */
	.sidebar-section :global(.maturity) {
		background: transparent;
		padding: 0;
	}

	/* ── Domain list ── */
	.domain-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.domain-item {
		position: relative;
	}

	.domain-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.domain-name {
		font-size: 0.8125rem;
		color: var(--color-neutral-300, #d1d5db);
	}

	.domain-count {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		font-variant-numeric: tabular-nums;
	}

	.domain-track {
		height: 4px;
		background: var(--color-neutral-700, #374151);
		border-radius: 2px;
	}

	.domain-fill {
		height: 100%;
		border-radius: 2px;
		background: var(--color-primary-500, #6366f1);
		transition: width 0.4s ease;
	}

	.domain-header-right {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.vital-tag {
		font-size: 0.625rem;
		color: var(--color-success, #10b981);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* ── Estimate action ── */
	.estimate-action :global(.btn) {
		width: 100%;
	}

	.estimate-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.6rem 0.9rem;
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 8px;
		text-decoration: none;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}

	.estimate-link:hover {
		background: rgba(99, 102, 241, 0.2);
	}

	.estimate-link-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #c7d2fe;
	}

	.estimate-status-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.status-pending,
	.status-running {
		background: rgba(99, 102, 241, 0.2);
		color: #a5b4fc;
	}

	.status-done,
	.status-approved {
		background: rgba(16, 185, 129, 0.2);
		color: #6ee7b7;
	}

	.status-failed {
		background: rgba(239, 68, 68, 0.2);
		color: #fca5a5;
	}

	.project-link {
		background: rgba(16, 185, 129, 0.1);
		border-color: rgba(16, 185, 129, 0.3);
	}

	.project-link:hover {
		background: rgba(16, 185, 129, 0.18);
	}

	.project-link-name {
		font-size: 0.75rem;
		color: #6ee7b7;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Documents ── */
	.documents-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* ── Chat area ── */
	.chat-area {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1.5rem;
		border-bottom: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		flex-shrink: 0;
	}

	.chat-header h2 {
		font-size: 1rem;
		font-weight: 600;
		color: #f9fafb;
		margin: 0;
	}

	/* ── Alerts ── */
	.alert {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.alert-error {
		background: color-mix(in srgb, var(--color-error, #ef4444) 15%, var(--color-dark-bg, #0f1117));
		color: var(--color-error, #ef4444);
		border-bottom: 1px solid color-mix(in srgb, var(--color-error, #ef4444) 25%, transparent);
	}

	.alert-dismiss {
		background: none;
		border: none;
		color: inherit;
		font-size: 1.125rem;
		cursor: pointer;
		padding: 0 0.25rem;
		opacity: 0.7;
	}

	.alert-dismiss:hover {
		opacity: 1;
	}

	/* ── Messages ── */
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-height: 0;
	}

	.empty-chat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		height: 100%;
		color: var(--color-neutral-500, #6b7280);
	}

	.empty-chat p {
		margin: 0;
	}

	/* ── Streaming ── */
	.streaming-bubble {
		position: relative;
		display: flex;
		align-items: flex-end;
	}

	.cursor {
		display: inline-block;
		width: 2px;
		height: 1.125rem;
		background: var(--color-primary-500, #6366f1);
		margin-left: -0.75rem;
		margin-bottom: 1.25rem;
		animation: blink 0.8s step-end infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}

	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.875rem 1rem;
		background: var(--color-dark-surface, #1a1d27);
		border-radius: 12px;
		border-bottom-left-radius: 4px;
		align-self: flex-start;
		width: fit-content;
	}

	.typing-indicator .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-neutral-500, #6b7280);
		animation: bounce 1.4s ease-in-out infinite;
	}

	.typing-indicator .dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-indicator .dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes bounce {
		0%, 60%, 100% { transform: translateY(0); }
		30% { transform: translateY(-4px); }
	}

	/* ── Input area ── */
	.input-area {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		border-top: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		background: var(--color-dark-bg, #0f1117);
		flex-shrink: 0;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		background: var(--color-dark-surface, #1a1d27);
		color: var(--color-neutral-500, #6b7280);
		cursor: pointer;
		flex-shrink: 0;
		transition: color 0.2s, border-color 0.2s;
	}

	.icon-btn:hover:not(:disabled) {
		color: var(--color-primary-500, #6366f1);
		border-color: var(--color-primary-500, #6366f1);
	}

	.icon-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	textarea {
		flex: 1;
		resize: none;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		background: var(--color-dark-surface, #1a1d27);
		color: var(--color-neutral-300, #d1d5db);
		border-radius: 8px;
		padding: 0.5rem 0.875rem;
		font-size: 0.9375rem;
		font-family: inherit;
		line-height: 1.5;
		outline: none;
		min-height: 36px;
		max-height: 120px;
	}

	textarea:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	textarea:disabled {
		opacity: 0.5;
	}

	/* ── Estimate panel ── */
	.estimate-panel {
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: var(--color-dark-surface, #1a1d27);
		padding: 0.875rem 1.25rem;
		flex-shrink: 0;
	}

	.estimate-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.estimate-panel-title {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.estimate-panel-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.7);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.estimate-panel-badge {
		font-size: 0.6875rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 99px;
		text-transform: lowercase;
	}

	.status-badge-done       { background: rgba(16,185,129,.18); color: #10b981; }
	.status-badge-pending    { background: rgba(99,102,241,.18); color: #818cf8; }
	.status-badge-running    { background: rgba(99,102,241,.18); color: #818cf8; }
	.status-badge-failed     { background: rgba(239,68,68,.18);  color: #f87171; }
	.status-badge-pending_approval { background: rgba(245,158,11,.18); color: #fbbf24; }

	.panel-spinner {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255,255,255,0.15);
		border-top-color: var(--color-primary-500, #6366f1);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	.estimate-panel-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.panel-link-btn {
		font-size: 0.75rem;
		color: var(--color-primary-500, #6366f1);
		text-decoration: none;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: background 0.15s;
	}

	.panel-link-btn:hover { background: rgba(99,102,241,0.12); }

	.panel-close-btn {
		background: none;
		border: none;
		color: rgba(255,255,255,0.4);
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0.25rem 0.375rem;
		border-radius: 4px;
		line-height: 1;
		transition: color 0.15s, background 0.15s;
	}

	.panel-close-btn:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.06); }

	.estimate-panel-steps {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.panel-step {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3rem 0.625rem;
		border-radius: 6px;
		font-size: 0.75rem;
		border: 1px solid rgba(255,255,255,0.06);
		background: rgba(255,255,255,0.03);
		transition: background 0.15s;
	}

	.panel-step-done    { border-color: rgba(16,185,129,.3);  background: rgba(16,185,129,.07); }
	.panel-step-failed  { border-color: rgba(239,68,68,.3);   background: rgba(239,68,68,.07);  }
	.panel-step-running { border-color: rgba(99,102,241,.4);  background: rgba(99,102,241,.1);  }

	.panel-step-dot {
		font-size: 0.8125rem;
		line-height: 1;
		font-weight: 700;
	}

	.panel-step-done    .panel-step-dot { color: #10b981; }
	.panel-step-failed  .panel-step-dot { color: #f87171; }
	.panel-step-running .panel-step-dot { color: #818cf8; }
	.panel-step-pending .panel-step-dot { color: rgba(255,255,255,0.25); }

	.panel-step-name { color: rgba(255,255,255,0.7); }
	.panel-step-done .panel-step-name { color: rgba(255,255,255,0.9); }

	.panel-step-dur {
		color: rgba(255,255,255,0.35);
		font-size: 0.6875rem;
	}

	.panel-step-error {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: rgba(239,68,68,.3);
		color: #f87171;
		font-size: 0.625rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: help;
		flex-shrink: 0;
	}

	/* ── Responsive ── */
	@media (max-width: 768px) {
		.interview-page {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		.sidebar {
			border-right: none;
			border-bottom: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
			max-height: 40vh;
		}
	}
</style>
