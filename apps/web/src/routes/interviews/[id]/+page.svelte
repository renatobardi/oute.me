<script lang="ts">
	import { goto } from '$app/navigation';
	import { ChatBubble, MaturityBar, DocumentCard, Button } from '@oute/ui';
	import { createChatState } from '$lib/stores/chat.svelte';
	import { MATURITY_THRESHOLD } from '$lib/types/interview';
	import '@oute/ui/theme.css';

	let { data } = $props();

	const chat = createChatState(
		data.interview.id,
		data.messages,
		data.interview.maturity,
		data.interview.state.domains
	);

	let inputText = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);
	let chatContainer = $state<HTMLElement | null>(null);
	let isRequestingEstimate = $state(false);

	let canEstimate = $derived(chat.maturity >= MATURITY_THRESHOLD && !chat.isStreaming);

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
		// auto-scroll on new messages
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
</script>

<svelte:head>
	<title>{data.interview.title || 'Entrevista'} — oute.me</title>
</svelte:head>

<div class="interview-page">
	<aside class="sidebar">
		<h2>{data.interview.title || 'Nova Entrevista'}</h2>
		<MaturityBar maturity={chat.maturity} domains={chat.domains} />

		{#if canEstimate}
			<div class="estimate-action">
				<Button onclick={requestEstimate} disabled={isRequestingEstimate} size="lg">
					{isRequestingEstimate ? 'Gerando...' : 'Gerar Estimativa'}
				</Button>
			</div>
		{/if}

		{#if data.documents.length > 0}
			<div class="documents">
				<h3>Documentos</h3>
				{#each data.documents as doc (doc.id)}
					<DocumentCard filename={doc.filename} status={doc.status as 'pending' | 'processing' | 'completed' | 'failed'} mimeType={doc.mime_type} />
				{/each}
			</div>
		{/if}
	</aside>

	<main class="chat-area">
		<div class="messages" bind:this={chatContainer}>
			{#if chat.messages.length === 0 && !chat.isStreaming}
				<div class="empty-chat">
					<p>Envie uma mensagem para iniciar a entrevista.</p>
				</div>
			{/if}

			{#each chat.messages as msg (msg.id)}
				<ChatBubble role={msg.role} content={msg.content} timestamp={msg.timestamp} />
			{/each}

			{#if chat.currentStreamText}
				<ChatBubble role="assistant" content={chat.currentStreamText} />
			{/if}
		</div>

		{#if chat.error}
			<div class="error-bar">{chat.error}</div>
		{/if}

		<div class="input-area">
			<input
				type="file"
				bind:this={fileInput}
				onchange={handleFileUpload}
				accept=".pdf,.docx,.xlsx,.csv,.pptx,.png,.jpg,.jpeg,.webp"
				hidden
			/>
			<button class="upload-btn" onclick={() => fileInput?.click()} disabled={chat.isStreaming}>
				📎
			</button>
			<textarea
				bind:value={inputText}
				onkeydown={handleKeydown}
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
	.interview-page {
		display: grid;
		grid-template-columns: 280px 1fr;
		height: 100vh;
		background: var(--color-dark-bg, #0f1117);
		color: var(--color-neutral-300, #d1d5db);
	}

	.sidebar {
		padding: 1.5rem;
		border-right: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		overflow-y: auto;
	}

	.sidebar h2 {
		font-size: 1.125rem;
		margin-bottom: 1.5rem;
	}

	.estimate-action {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	.estimate-action :global(.btn) {
		width: 100%;
	}

	.documents {
		margin-top: 1.5rem;
	}

	.documents h3 {
		font-size: 0.875rem;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.5rem;
	}

	.chat-area {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.empty-chat {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-neutral-500, #6b7280);
	}

	.error-bar {
		padding: 0.5rem 1rem;
		background: var(--color-error, #ef4444);
		color: white;
		font-size: 0.875rem;
		text-align: center;
	}

	.input-area {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	.upload-btn {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0.5rem;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.upload-btn:hover:not(:disabled) {
		opacity: 1;
	}

	.upload-btn:disabled {
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
		padding: 0.625rem 0.875rem;
		font-size: 0.9375rem;
		font-family: inherit;
		outline: none;
	}

	textarea:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	textarea:disabled {
		opacity: 0.5;
	}
</style>
