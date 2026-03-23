<script lang="ts">
	import type { InterviewMessage } from '$lib/types/interview';
	import { fmtDate } from '$lib/utils/admin';

	let {
		messages: initialMessages,
		messageTotal,
		loadmore,
	}: {
		messages: InterviewMessage[];
		messageTotal: number;
		loadmore: (offset: number) => Promise<InterviewMessage[]>;
	} = $props();

	let messages = $state<InterviewMessage[]>([...(initialMessages ?? [])]);
	let offset = $state(initialMessages?.length ?? 0);
	let loading = $state(false);

	$effect(() => {
		messages = [...initialMessages];
		offset = initialMessages.length;
	});

	async function handleLoadMore() {
		loading = true;
		try {
			const older = await loadmore(offset);
			messages = [...older, ...messages];
			offset += older.length;
		} finally {
			loading = false;
		}
	}
</script>

<div class="tab-content">
	<div class="section-title">
		Conversa
		<span class="muted" style="font-weight:400;font-size:0.8rem">
			({messageTotal} mensagens)
		</span>
	</div>

	{#if messageTotal > messages.length}
		<button class="load-more-btn" disabled={loading} onclick={handleLoadMore}>
			{loading ? 'Carregando…' : '↑ Carregar mensagens anteriores'}
		</button>
	{/if}

	<div class="messages">
		{#each messages as msg (msg.id)}
			<div
				class="msg"
				class:msg-user={msg.role === 'user'}
				class:msg-ai={msg.role !== 'user'}
			>
				<div class="msg-role">{msg.role === 'user' ? 'Usuário' : 'IA'}</div>
				<div class="msg-text">{msg.content}</div>
				<div class="msg-time muted">{fmtDate(msg.created_at)}</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.tab-content {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 1rem 1.125rem;
		margin-top: 0.5rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.75rem;
	}

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

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}
</style>
