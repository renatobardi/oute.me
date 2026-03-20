<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { AgentInstruction } from '$lib/server/agent-instructions';

	let { data } = $props();

	let instruction: AgentInstruction = data.instruction;
	let content = $state(instruction.content);
	let saving = $state(false);
	let saved = $state(false);
	let errorMsg = $state('');

	let charCount = $derived(content.length);

	async function save() {
		saving = true;
		saved = false;
		errorMsg = '';
		try {
			const token = await auth.currentUser?.getIdToken(false);
			const res = await fetch(`/api/admin/agents/${instruction.agent_key}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ content }),
			});
			if (res.ok) {
				saved = true;
				setTimeout(() => (saved = false), 3000);
			} else {
				errorMsg = 'Erro ao salvar';
			}
		} catch {
			errorMsg = 'Erro de conexao';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{instruction.title} — Admin</title>
</svelte:head>

<div class="page">
	<a href="/admin/agents" class="back-link">← Voltar para Agentes</a>

	<div class="header">
		<h1>{instruction.title}</h1>
		<span class="agent-key">{instruction.agent_key}</span>
	</div>

	<div class="editor-wrapper">
		<textarea class="editor" bind:value={content} placeholder="Escreva as instrucoes em Markdown..."
		></textarea>

		<div class="footer">
			<span class="char-count">{charCount} caracteres</span>
			<div class="actions">
				{#if saved}
					<span class="feedback success">Salvo!</span>
				{/if}
				{#if errorMsg}
					<span class="feedback error">{errorMsg}</span>
				{/if}
				<button class="btn-save" onclick={save} disabled={saving}>
					{saving ? 'Salvando...' : 'Salvar'}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.page {
		padding: 2rem 1.5rem;
		max-width: 900px;
		margin: 0 auto;
	}

	.back-link {
		color: var(--color-neutral-500, #6b7280);
		text-decoration: none;
		font-size: 0.875rem;
		display: inline-block;
		margin-bottom: 1.5rem;
	}

	.back-link:hover {
		color: var(--color-neutral-300, #d1d5db);
	}

	.header {
		margin-bottom: 1.5rem;
	}

	.header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0 0 0.25rem;
	}

	.agent-key {
		font-size: 0.8125rem;
		color: var(--color-neutral-500, #6b7280);
		font-family: monospace;
	}

	.editor-wrapper {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		border-radius: 10px;
		overflow: hidden;
	}

	.editor {
		width: 100%;
		min-height: 500px;
		padding: 1.25rem;
		border: none;
		background: transparent;
		color: #f9fafb;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		resize: vertical;
		box-sizing: border-box;
	}

	.editor:focus {
		outline: none;
	}

	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	.char-count {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.feedback {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.feedback.success {
		color: var(--color-success, #10b981);
	}

	.feedback.error {
		color: var(--color-error, #ef4444);
	}

	.btn-save {
		padding: 0.5rem 1.25rem;
		border-radius: 6px;
		border: none;
		background: var(--color-primary-600, #4f46e5);
		color: #fff;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
	}

	.btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-save:hover:not(:disabled) {
		background: var(--color-primary-500, #6366f1);
	}
</style>
