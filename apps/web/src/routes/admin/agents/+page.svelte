<script lang="ts">
	import { scrollShadow } from '$lib/actions/scroll-shadow';
	import { auth } from '$lib/firebase';
	import type { AgentInstruction } from '$lib/server/agent-instructions';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let instructions = $state<AgentInstruction[]>(data.instructions);
	let selectedKey = $state<string | null>(null);
	let editContent = $state('');
	let editTemperature = $state(0.7);
	let editMaxTokens = $state(4096);
	let editEnabled = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let errorMsg = $state('');
	let agentOutput = $state<Record<string, unknown> | null>(null);
	let loadingOutput = $state(false);

	const selected = $derived(instructions.find((a) => a.agent_key === selectedKey) ?? null);
	const charCount = $derived(editContent.length);

	async function selectAgent(key: string) {
		if (selectedKey === key) return;
		selectedKey = key;
		saved = false;
		errorMsg = '';
		agentOutput = null;
		const agent = instructions.find((a) => a.agent_key === key);
		editContent = agent?.content ?? '';
		editTemperature = agent?.temperature ?? 0.7;
		editMaxTokens = agent?.max_tokens ?? 4096;
		editEnabled = agent?.enabled ?? true;

		if (data.latestJobId) {
			loadingOutput = true;
			try {
				const token = await auth.currentUser?.getIdToken(false);
				const res = await fetch(
					`/api/admin/agents/${key}/output?job_id=${data.latestJobId}`,
					{ headers: token ? { Authorization: `Bearer ${token}` } : {} }
				);
				if (res.ok) {
					const json = await res.json();
					agentOutput = json?.output ?? null;
				}
			} catch {
				// ignore — output not available
			} finally {
				loadingOutput = false;
			}
		}
	}

	async function save() {
		if (!selectedKey) return;
		saving = true;
		saved = false;
		errorMsg = '';
		try {
			const token = await auth.currentUser?.getIdToken(false);
			const res = await fetch(`/api/admin/agents/${selectedKey}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({
					content: editContent,
					temperature: editTemperature,
					max_tokens: editMaxTokens,
					enabled: editEnabled,
				}),
			});
			if (res.ok) {
				const updated = await res.json();
				instructions = instructions.map((a) =>
					a.agent_key === selectedKey ? updated : a
				);
				saved = true;
				setTimeout(() => (saved = false), 3000);
			} else {
				errorMsg = 'Erro ao salvar';
			}
		} catch {
			errorMsg = 'Erro de conexão';
		} finally {
			saving = false;
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('pt-BR');
	}
</script>

<svelte:head>
	<title>Agentes — Admin</title>
</svelte:head>

<div class="page">
	<div class="split">
		<!-- Left: agent list -->
		<div class="list-panel">
			<div class="list-count">{instructions.length} agente{instructions.length !== 1 ? 's' : ''}</div>

			<div class="list-items" use:scrollShadow>
				{#each instructions as agent (agent.id)}
					<button
						class="list-item"
						class:selected={selectedKey === agent.agent_key}
						onclick={() => selectAgent(agent.agent_key)}
					>
						<div class="item-top">
							<span class="item-name">{agent.title}</span>
						</div>
						<div class="item-meta">
							<span class="agent-key">{agent.agent_key}</span>
							<span>{agent.content.length} chars</span>
						</div>
						<div class="item-date">{formatDate(agent.updated_at)}</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Right: editor -->
		<div class="detail-panel" use:scrollShadow>
			{#if !selected}
				<div class="detail-empty">Selecione um agente para editar as instruções.</div>
			{:else}
				<div class="editor-header">
					<div>
						<h2 class="editor-title">{selected.title}</h2>
						<span class="agent-key">{selected.agent_key}</span>
					</div>
					<label class="toggle-wrap">
						<input type="checkbox" bind:checked={editEnabled} />
						<span class="toggle-label">{editEnabled ? 'Ativo' : 'Desativado'}</span>
					</label>
				</div>

				<div class="config-row">
					<label class="config-field">
						<span class="config-label">Temperature</span>
						<div class="slider-wrap">
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								bind:value={editTemperature}
							/>
							<span class="slider-value">{editTemperature.toFixed(2)}</span>
						</div>
					</label>
					<label class="config-field">
						<span class="config-label">Max tokens</span>
						<input
							class="tokens-input"
							type="number"
							min="256"
							max="16384"
							step="256"
							bind:value={editMaxTokens}
						/>
					</label>
				</div>

				<div class="editor-wrapper">
					<textarea
						class="editor"
						bind:value={editContent}
						placeholder="Escreva as instruções em Markdown…"
					></textarea>

					<div class="editor-footer">
						<span class="char-count">{charCount} caracteres</span>
						<div class="actions">
							{#if saved}
								<span class="feedback success">Salvo!</span>
							{/if}
							{#if errorMsg}
								<span class="feedback error">{errorMsg}</span>
							{/if}
							<button class="btn-save" onclick={save} disabled={saving}>
								{saving ? 'Salvando…' : 'Salvar'}
							</button>
						</div>
					</div>
				</div>
			{#if data.latestJobId}
				<div class="output-section">
					<div class="output-header">
						<span class="output-title">Último output</span>
						{#if loadingOutput}
							<span class="output-loading">carregando…</span>
						{/if}
					</div>
					{#if agentOutput}
						<pre class="output-pre">{JSON.stringify(agentOutput, null, 2)}</pre>
					{:else if !loadingOutput}
						<div class="output-empty">Nenhum output disponível para este agente.</div>
					{/if}
				</div>
			{/if}
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

	.list-count {
		padding: 0.5rem 0.75rem;
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
		margin-bottom: 0.2rem;
	}

	.item-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f9fafb;
	}

	.item-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		margin-bottom: 0.15rem;
	}

	.agent-key {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.item-date {
		font-size: 0.7rem;
		color: var(--color-neutral-600, #4b5563);
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
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
		text-align: center;
		padding: 3rem 0;
	}

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.25rem;
	}

	.editor-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0 0 0.2rem;
	}

	.toggle-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
	}

	.toggle-label {
		font-size: 0.8125rem;
		color: var(--color-neutral-400, #9ca3af);
	}

	.config-row {
		display: flex;
		gap: 1.5rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.config-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		flex: 1;
		min-width: 160px;
	}

	.config-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.slider-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.slider-wrap input[type='range'] {
		flex: 1;
		accent-color: var(--color-primary-500, #6366f1);
	}

	.slider-value {
		font-family: monospace;
		font-size: 0.8125rem;
		color: #f9fafb;
		min-width: 2.5rem;
		text-align: right;
	}

	.tokens-input {
		width: 100%;
		padding: 0.35rem 0.6rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #f9fafb;
		font-size: 0.875rem;
	}

	.editor-wrapper {
		background: var(--color-dark-bg, #0f1117);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		overflow: hidden;
	}

	.editor {
		width: 100%;
		min-height: 420px;
		padding: 1rem;
		border: none;
		background: transparent;
		color: #f9fafb;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		resize: vertical;
		box-sizing: border-box;
		outline: none;
	}

	.editor-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
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
		padding: 0.45rem 1.1rem;
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

	/* ── Output preview ── */

	.output-section {
		margin-top: 1.25rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding-top: 1.25rem;
	}

	.output-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.output-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.output-loading {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
	}

	.output-pre {
		background: var(--color-dark-bg, #0f1117);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 1rem;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		color: #d1d5db;
		overflow: auto;
		max-height: 360px;
		white-space: pre-wrap;
		word-break: break-all;
		margin: 0;
	}

	.output-empty {
		font-size: 0.8125rem;
		color: var(--color-neutral-500, #6b7280);
		text-align: center;
		padding: 1.5rem 0;
	}
</style>
