<script lang="ts">
	import { goto } from '$app/navigation';
	import { ChatBubble, MaturityBar, DocumentCard, Button, StatusBadge } from '@oute/ui';
	import { createChatState } from '$lib/stores/chat.svelte';
	import { MATURITY_THRESHOLD } from '$lib/types/interview';

	let { data } = $props();

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
		data.toneAction ?? null
	);

	let inputText = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);
	let chatContainer = $state<HTMLElement | null>(null);
	let isRequestingEstimate = $state(false);

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
			if (!res.ok) throw new Error('Failed to create estimate');
			const result = await res.json();
			goto(`/estimates/${result.id}`);
		} catch {
			chat.error = 'Erro ao solicitar estimativa.';
			isRequestingEstimate = false;
		}
	}

	$effect(() => {
		if (chatContainer && (chat.messages.length || chat.currentStreamText)) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
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
	<title>{data.interview.title || 'Entrevista'} — oute.me</title>
</svelte:head>

<div class="interview-page">
	<!-- SIDEBAR -->
	<aside class="sidebar">
		<h2 class="sidebar-title">{data.interview.title || 'Nova Entrevista'}</h2>

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
							<span class="domain-count">{domain.answered}/{domain.total}</span>
						</div>
						<div class="domain-track">
							<div class="domain-fill" style="width: {progress}%"></div>
						</div>
						{#if domain.vital_answered}
							<span class="vital-tag">vital</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		{#if canEstimate}
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
						/>
					{/each}
				</div>
			</div>
		{/if}
	</aside>

	<!-- CHAT -->
	<main class="chat-area">
		<header class="chat-header">
			<h2>Entrevista</h2>
			<StatusBadge status={data.interview.status} size="sm" />
		</header>

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

	.sidebar-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0 0 1rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	.vital-tag {
		position: absolute;
		top: 0;
		right: -0.125rem;
		font-size: 0.625rem;
		color: var(--color-success, #10b981);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		transform: translateY(-0.125rem);
	}

	/* ── Estimate action ── */
	.estimate-action :global(.btn) {
		width: 100%;
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
