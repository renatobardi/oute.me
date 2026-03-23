<script lang="ts">
	import type { CockpitDetail } from '$lib/server/admin-cockpit';
	import type { AgentStep } from '$lib/types/estimate';
	import { scrollShadow } from '$lib/actions/scroll-shadow';
	import { fmtDate, maturityColor } from '$lib/utils/admin';
	import {
		downloadAdminDocument,
		loadInterviewMessages,
		fetchAgentOutputApi,
		triggerPipelineRun,
	} from '$lib/utils/adminApi';

	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import DomainProgress from '$lib/components/admin/DomainProgress.svelte';
	import RerunModal from '$lib/components/admin/RerunModal.svelte';
	import UserTab from '$lib/components/admin/tabs/UserTab.svelte';
	import ProjectTab from '$lib/components/admin/tabs/ProjectTab.svelte';
	import DocumentsTab from '$lib/components/admin/tabs/DocumentsTab.svelte';
	import MessagesTab from '$lib/components/admin/tabs/MessagesTab.svelte';
	import VectorsTab from '$lib/components/admin/tabs/VectorsTab.svelte';
	import EstimateTab from '$lib/components/admin/tabs/EstimateTab.svelte';
	import PipelineTab from '$lib/components/admin/tabs/PipelineTab.svelte';
	import ProjectGeneratedTab from '$lib/components/admin/tabs/ProjectGeneratedTab.svelte';
	
	let {
		detail,
		loadingDetail,
		selectedId,
		getToken,
	}: {
		detail: CockpitDetail | null;
		loadingDetail: boolean;
		selectedId: string | null;
		getToken: () => Promise<string>;
	} = $props();

	let activeTab = $state<string | null>(null);
	let rerunning = $state(false);
	let rerunMsg = $state('');
	let rerunModal = $state(false);
	let rerunFromAgent = $state('');

	// Reset tab when interview changes
	$effect(() => {
		void selectedId; // track dependency
		activeTab = null;
		rerunMsg = '';
	});

	function toggleTab(tab: string) {
		activeTab = activeTab === tab ? null : tab;
	}

	async function downloadDocument(docId: string) {
		const token = await getToken();
		const res = await downloadAdminDocument(docId, token);
		if (!res.ok) {
			alert('Arquivo não disponível para download.');
			return;
		}
		const blob = await res.blob();
		const cd = res.headers.get('Content-Disposition') ?? '';
		const match = cd.match(/filename="?([^"]+)"?/);
		const filename = match?.[1] ?? 'documento';
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = decodeURIComponent(filename);
		a.click();
		URL.revokeObjectURL(url);
	}

	async function loadMoreMessages(offset: number): Promise<InterviewMessage[]> {
		if (!selectedId) return [];
		const token = await getToken();
		const data = await loadInterviewMessages(selectedId, offset, 20, token);
		return data.messages ?? [];
	}

	async function fetchAgentOutput(interviewId: string, agentKey: string) {
		const token = await getToken();
		return fetchAgentOutputApi(interviewId, agentKey, token);
	}

	function openRerunModal() {
		const steps = (detail?.estimate?.agent_steps ?? []) as AgentStep[];
		const failedStep = steps.find((s) => s.status === 'failed');
		rerunFromAgent = failedStep?.agent_key ?? '';
		rerunModal = true;
	}

	async function triggerRerun(params: { llm_model: string; from_agent: string }) {
		rerunModal = false;
		rerunning = true;
		rerunMsg = '';
		try {
			const token = await getToken();
			const result = await triggerPipelineRun(selectedId!, params, token);
			rerunMsg = result.ok ? 'Re-run iniciado!' : `Erro: ${result.error}`;
		} catch {
			rerunMsg = 'Erro de conexão';
		} finally {
			rerunning = false;
			setTimeout(() => (rerunMsg = ''), 4000);
		}
	}

	async function triggerDirectRun() {
		await triggerRerun({ llm_model: 'gemini-2.5-flash', from_agent: '' });
	}
</script>

<div class="detail-panel" use:scrollShadow>
	{#if !selectedId}
		<div class="detail-empty">Selecione uma entrevista para ver os detalhes.</div>
	{:else if loadingDetail}
		<div class="detail-empty">Carregando…</div>
	{:else if detail}
		{@const iv = detail.interview}

		<!-- Header -->
		<div class="detail-header">
			<div>
				<h2 class="detail-title">{iv.title ?? 'Sem título'}</h2>
				<div class="detail-sub">
					<StatusBadge status={iv.status} />
					<span class="muted">criado em {fmtDate(iv.created_at)}</span>
					<span class="muted">atualizado em {fmtDate(iv.updated_at)}</span>
				</div>
			</div>
			<div class="maturity-block">
				<div class="maturity-pct" style="color:{maturityColor(iv.maturity ?? 0)}">
					{Math.round((iv.maturity ?? 0) * 100)}%
				</div>
				<div class="muted" style="font-size:0.75rem">maturidade</div>
			</div>
		</div>

		<!-- Tab cards -->
		<div class="tab-grid">
			<button
				class="tab-card"
				class:tab-active={activeTab === 'usuario'}
				onclick={() => toggleTab('usuario')}
			>
				<div class="tab-label">Usuário</div>
				<div class="tab-value">{detail.user_name ?? detail.user_email}</div>
			</button>

			<button
				class="tab-card"
				class:tab-active={activeTab === 'projeto'}
				onclick={() => toggleTab('projeto')}
			>
				<div class="tab-label">Tipo de Projeto</div>
				<div class="tab-value">{iv.state?.project_type ?? '—'}</div>
			</button>

			<button
				class="tab-card"
				class:tab-active={activeTab === 'documentos'}
				onclick={() => toggleTab('documentos')}
			>
				<div class="tab-label">Documentos</div>
				<div class="tab-value">{detail.documents.length}</div>
			</button>

			<button
				class="tab-card"
				class:tab-active={activeTab === 'mensagens'}
				onclick={() => toggleTab('mensagens')}
			>
				<div class="tab-label">Mensagens</div>
				<div class="tab-value">{detail.messageTotal}</div>
			</button>

			<button
				class="tab-card"
				class:tab-active={activeTab === 'vetores'}
				onclick={() => toggleTab('vetores')}
			>
				<div class="tab-label">Vetores</div>
				<div class="tab-value">{detail.knowledgeVectors.length}</div>
			</button>

			{#if detail.estimate}
				<button
					class="tab-card"
					class:tab-active={activeTab === 'estimativa'}
					onclick={() => toggleTab('estimativa')}
				>
					<div class="tab-label">Estimativa</div>
					<div class="tab-value">
						<StatusBadge status={detail.estimate.status} />
					</div>
				</button>
				<button
					class="tab-card"
					class:tab-active={activeTab === 'pipeline'}
					onclick={() => { toggleTab('pipeline'); }}
				>
					<div class="tab-label">Pipeline</div>
					<div class="tab-value">{detail.estimate.agent_steps?.length ?? 0} passos</div>
				</button>
			{/if}

			{#if detail.project}
				<button
					class="tab-card"
					class:tab-active={activeTab === 'projeto-gerado'}
					onclick={() => toggleTab('projeto-gerado')}
				>
					<div class="tab-label">Projeto</div>
					<div class="tab-value">{detail.project.name ?? detail.project.id}</div>
				</button>
			{/if}
		</div>

		<!-- Domains — always visible -->
		{#if iv.state?.domains}
			<DomainProgress domains={iv.state.domains} />
		{/if}

		<!-- Tab content -->
		{#if activeTab === 'usuario'}
			<UserTab
				userName={detail.user_name}
				userEmail={detail.user_email}
				userId={iv.user_id}
			/>

		{:else if activeTab === 'projeto'}
			<ProjectTab state={iv.state} />

		{:else if activeTab === 'documentos'}
			<DocumentsTab documents={detail.documents} download={downloadDocument} />

		{:else if activeTab === 'mensagens'}
			<MessagesTab
				messages={detail.messages}
				messageTotal={detail.messageTotal}
				loadmore={loadMoreMessages}
			/>

		{:else if activeTab === 'vetores'}
			<VectorsTab vectors={detail.knowledgeVectors} />

		{:else if activeTab === 'estimativa' && detail.estimate}
			<EstimateTab estimate={detail.estimate} />

		{:else if activeTab === 'pipeline' && detail.estimate}
			<PipelineTab
				interviewId={iv.id}
				estimate={detail.estimate}
				estimateRuns={detail.estimateRuns}
				{rerunning}
				{rerunMsg}
				{fetchAgentOutput}
				onOpenRerunModal={openRerunModal}
				onTriggerRerun={triggerDirectRun}
			/>

		{:else if activeTab === 'projeto-gerado' && detail.project}
			<ProjectGeneratedTab project={detail.project} />
		{/if}
	{/if}
</div>

<RerunModal
	open={rerunModal}
	initialFromAgent={rerunFromAgent}
	onconfirm={triggerRerun}
	oncancel={() => (rerunModal = false)}
/>

<style>
	.detail-panel {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.5rem;
		overflow-y: auto;
		max-height: calc(100vh - 8rem);
	}

	.detail-empty {
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
		text-align: center;
		padding: 3rem 0;
	}

	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.25rem;
	}

	.detail-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0 0 0.4rem;
	}

	.detail-sub {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.timeline-section {
		margin-top: 0.875rem;
		padding: 0.875rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
	}

	.maturity-block {
		text-align: center;
		min-width: 60px;
	}

	.maturity-pct {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}

	/* Tab cards */
	.tab-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.6rem;
		margin-bottom: 1.25rem;
	}

	.tab-card {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 8px;
		padding: 0.7rem 0.875rem;
		cursor: pointer;
		text-align: left;
		color: inherit;
		transition: background 0.15s, border-color 0.15s;
	}

	.tab-card:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.tab-card.tab-active {
		background: rgba(99, 102, 241, 0.12);
		border-color: var(--color-primary-500, #6366f1);
	}

	.tab-label {
		font-size: 0.68rem;
		color: var(--color-neutral-500, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}

	.tab-value {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #f9fafb;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}
</style>
