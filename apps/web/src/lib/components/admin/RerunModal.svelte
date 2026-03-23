<script lang="ts">
	import { AGENT_LABELS } from '$lib/types/estimate';

	const LLM_MODELS = [
		{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
		{ value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
		{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
	];

	let {
		open,
		initialFromAgent = '',
		onconfirm,
		oncancel,
	}: {
		open: boolean;
		initialFromAgent?: string;
		onconfirm: (params: { llm_model: string; from_agent: string }) => void;
		oncancel: () => void;
	} = $props();

	let rerunModel = $state('gemini-2.5-flash');
	let rerunFromAgent = $state('');

	$effect(() => {
		if (open) {
			rerunModel = 'gemini-2.5-flash';
			rerunFromAgent = initialFromAgent;
		}
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={oncancel}>
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
			<h3 class="modal-title">Re-run Pipeline</h3>

			<label class="modal-field">
				<span class="modal-label">Modelo LLM</span>
				<select class="modal-select" bind:value={rerunModel}>
					{#each LLM_MODELS as m (m.value)}
						<option value={m.value}>{m.label}</option>
					{/each}
				</select>
			</label>

			<label class="modal-field">
				<span class="modal-label">Recomeçar a partir de</span>
				<select class="modal-select" bind:value={rerunFromAgent}>
					<option value="">Início (rodar tudo)</option>
					{#each Object.entries(AGENT_LABELS) as [key, label] (key)}
						<option value={key}>{label}</option>
					{/each}
				</select>
			</label>

			{#if rerunFromAgent}
				<p class="modal-hint">
					Outputs anteriores a <strong>{AGENT_LABELS[rerunFromAgent] ?? rerunFromAgent}</strong> serão reutilizados.
				</p>
			{/if}

			<div class="modal-actions">
				<button class="btn-cancel" onclick={oncancel}>Cancelar</button>
				<button class="btn-rerun" onclick={() => onconfirm({ llm_model: rerunModel, from_agent: rerunFromAgent })}>
					Iniciar Re-run
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		padding: 1.75rem;
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.modal-title {
		font-size: 1rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0;
	}

	.modal-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.modal-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.modal-select {
		padding: 0.45rem 0.6rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #f9fafb;
		font-size: 0.875rem;
	}

	.modal-hint {
		font-size: 0.8125rem;
		color: var(--color-neutral-400, #9ca3af);
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: rgba(99, 102, 241, 0.08);
		border-left: 3px solid var(--color-primary-500, #6366f1);
		border-radius: 4px;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}

	.btn-cancel {
		padding: 0.45rem 1rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: transparent;
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.btn-cancel:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.btn-rerun {
		padding: 0.35rem 0.9rem;
		background: var(--color-primary-600, #4f46e5);
		border: none;
		border-radius: 6px;
		color: #fff;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
	}
</style>
