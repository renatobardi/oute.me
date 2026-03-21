<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { CockpitInterview, CockpitDetail } from '$lib/server/admin-cockpit';
	import type { AgentStep } from '$lib/types/estimate';
	import { AGENT_LABELS } from '$lib/types/estimate';

	let { data } = $props();

	let interviews = $state<CockpitInterview[]>(data.interviews);
	let search = $state('');
	let statusFilter = $state('active');
	let selectedId = $state<string | null>(null);
	let detail = $state<CockpitDetail | null>(null);
	let loadingDetail = $state(false);
	let activeTab = $state<string | null>(null);
	let loadingMoreMessages = $state(false);
	let messagesOffset = $state(20);
	let agentOutputKey = $state<string | null>(null);
	let agentOutputData = $state<Record<string, unknown> | null>(null);
	let loadingAgentOutput = $state(false);
	let rerunning = $state(false);
	let rerunMsg = $state('');

	async function getToken() {
		return (await auth.currentUser?.getIdToken(false)) ?? '';
	}

	const filtered = $derived(
		interviews.filter((iv) => {
			const q = search.toLowerCase();
			const matchSearch =
				!q ||
				(iv.title ?? '').toLowerCase().includes(q) ||
				iv.user_email.toLowerCase().includes(q) ||
				(iv.user_name ?? '').toLowerCase().includes(q);
			const matchStatus = !statusFilter || iv.status === statusFilter;
			return matchSearch && matchStatus;
		})
	);

	async function selectInterview(id: string) {
		if (selectedId === id) return;
		selectedId = id;
		detail = null;
		activeTab = null;
		messagesOffset = 20;
		loadingDetail = true;
		try {
			const token = await getToken();
			const res = await fetch(`/api/admin/cockpit/interviews/${id}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) detail = await res.json();
		} finally {
			loadingDetail = false;
		}
	}

	function toggleTab(tab: string) {
		activeTab = activeTab === tab ? null : tab;
	}

	async function loadMoreMessages() {
		if (!selectedId || !detail) return;
		loadingMoreMessages = true;
		try {
			const token = await getToken();
			const res = await fetch(
				`/api/admin/cockpit/interviews/${selectedId}/messages?offset=${messagesOffset}&limit=20`,
				{ headers: token ? { Authorization: `Bearer ${token}` } : {} }
			);
			if (res.ok) {
				const data = await res.json();
				detail = {
					...detail,
					messages: [...data.messages, ...detail.messages],
				};
				messagesOffset += data.messages.length;
			}
		} finally {
			loadingMoreMessages = false;
		}
	}

	async function downloadDocument(docId: string) {
		const token = await getToken();
		const res = await fetch(`/api/admin/cockpit/documents/${docId}/download`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		});
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

	function fmtDate(iso: string | Date) {
		return new Date(iso).toLocaleString('pt-BR', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	function maturityColor(m: number) {
		if (m >= 0.7) return 'var(--color-success, #10b981)';
		if (m >= 0.4) return 'var(--color-warning, #f59e0b)';
		return 'var(--color-error, #ef4444)';
	}

	function statusBadgeClass(status: string) {
		switch (status) {
			case 'completed':
			case 'approved':
				return 'badge-success';
			case 'estimating':
			case 'in_progress':
				return 'badge-info';
			case 'failed':
				return 'badge-error';
			default:
				return 'badge-neutral';
		}
	}

	async function loadAgentOutput(interviewId: string, agentKey: string) {
		if (agentOutputKey === agentKey) {
			agentOutputKey = null;
			agentOutputData = null;
			return;
		}
		agentOutputKey = agentKey;
		agentOutputData = null;
		loadingAgentOutput = true;
		try {
			const token = await getToken();
			const res = await fetch(
				`/api/admin/cockpit/interviews/${interviewId}/pipeline?agent=${agentKey}`,
				{ headers: token ? { Authorization: `Bearer ${token}` } : {} }
			);
			if (res.ok) agentOutputData = await res.json();
		} finally {
			loadingAgentOutput = false;
		}
	}

	async function triggerRerun(interviewId: string) {
		rerunning = true;
		rerunMsg = '';
		try {
			const token = await getToken();
			const res = await fetch(`/api/admin/cockpit/interviews/${interviewId}/pipeline`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({}),
			});
			if (res.ok) {
				rerunMsg = 'Re-run iniciado!';
				// Refresh the detail
				await selectInterview(interviewId);
			} else {
				const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
				rerunMsg = `Erro: ${err.error ?? res.statusText}`;
			}
		} catch {
			rerunMsg = 'Erro de conexão';
		} finally {
			rerunning = false;
			setTimeout(() => (rerunMsg = ''), 4000);
		}
	}

	function stepStatusClass(status: string) {
		switch (status) {
			case 'done': return 'step-done';
			case 'running': return 'step-running';
			case 'failed': return 'step-failed';
			default: return 'step-pending';
		}
	}

	function mimeLabel(mime: string) {
		const map: Record<string, string> = {
			'application/pdf': 'PDF',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
			'application/msword': 'Word',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
			'application/vnd.ms-excel': 'Excel',
			'text/csv': 'CSV',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
			'application/vnd.ms-powerpoint': 'PowerPoint',
			'image/png': 'PNG',
			'image/jpeg': 'JPEG',
			'image/webp': 'WebP',
			'image/gif': 'GIF',
		};
		return map[mime] ?? mime;
	}

</script>

<svelte:head>
	<title>Cockpit — oute.pro</title>
</svelte:head>

<div class="page">
	<div class="cockpit">
		<!-- Left panel: interview list -->
		<div class="list-panel">
			<div class="list-toolbar">
				<input
					class="search-input"
					type="text"
					placeholder="Buscar por título, e-mail ou nome…"
					bind:value={search}
				/>
				<select class="status-select" bind:value={statusFilter}>
					<option value="">Todos</option>
					<option value="active">Ativos</option>
					<option value="archived">Arquivados</option>
				</select>
			</div>

			<div class="list-count">{filtered.length} entrevista{filtered.length !== 1 ? 's' : ''}</div>

			<div class="list-items">
				{#each filtered as iv (iv.id)}
					<button
						class="list-item"
						class:selected={selectedId === iv.id}
						onclick={() => selectInterview(iv.id)}
					>
						<div class="item-top">
							<span class="item-title">{iv.title ?? 'Sem título'}</span>
							<span class="badge {statusBadgeClass(iv.status)}">{iv.status}</span>
						</div>
						<div class="item-meta">
							<span>{iv.user_name ?? iv.user_email}</span>
							{#if iv.estimate_id}
								<span class="badge badge-info" style="font-size:0.65rem">est</span>
							{/if}
							{#if iv.project_id}
								<span class="badge badge-success" style="font-size:0.65rem">proj</span>
							{/if}
						</div>
						<div class="item-bar">
							<div
								class="maturity-fill"
								style="width:{Math.round(iv.maturity * 100)}%; background:{maturityColor(iv.maturity)}"
							></div>
						</div>
						<div class="item-date">{fmtDate(iv.updated_at)}</div>
					</button>
				{/each}

				{#if filtered.length === 0}
					<div class="empty">Nenhuma entrevista encontrada.</div>
				{/if}
			</div>
		</div>

		<!-- Right panel: detail -->
		<div class="detail-panel">
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
							<span class="badge {statusBadgeClass(iv.status)}">{iv.status}</span>
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
								<span class="badge {statusBadgeClass(detail.estimate.status)}"
									>{detail.estimate.status}</span
								>
							</div>
						</button>
						<button
							class="tab-card"
							class:tab-active={activeTab === 'pipeline'}
							onclick={() => { toggleTab('pipeline'); agentOutputKey = null; agentOutputData = null; }}
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
					<div class="section">
						<div class="section-title">Domínios</div>
						<div class="domains">
							{#each Object.entries(iv.state.domains) as [domain, d] (domain)}
								{@const dom = d as { answered: number; total: number; vital_answered: boolean }}
								<div class="domain-row">
									<span class="domain-name">{domain}</span>
									<div class="domain-bar-wrap">
										<div
											class="domain-bar-fill"
											style="width:{dom.total ? Math.round((dom.answered / dom.total) * 100) : 0}%"
										></div>
									</div>
									<span class="domain-count muted">{dom.answered}/{dom.total}</span>
									{#if dom.vital_answered}
										<span class="vital-ok">✓</span>
									{:else}
										<span class="vital-no">✗</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Tab content area -->
				{#if activeTab === 'usuario'}
					<div class="tab-content">
						<div class="section-title">Usuário</div>
						<div class="info-list">
							<div class="info-row">
								<span class="info-row-label">Nome</span>
								<span class="info-row-value">{detail.user_name ?? '—'}</span>
							</div>
							<div class="info-row">
								<span class="info-row-label">E-mail</span>
								<span class="info-row-value">{detail.user_email}</span>
							</div>
							<div class="info-row">
								<span class="info-row-label">ID</span>
								<span class="info-row-value mono">{iv.user_id}</span>
							</div>
						</div>
					</div>

				{:else if activeTab === 'projeto'}
					<div class="tab-content">
						<div class="section-title">Detalhes do Projeto</div>
						<div class="info-list">
							<div class="info-row">
								<span class="info-row-label">Tipo</span>
								<span class="info-row-value">{iv.state?.project_type ?? '—'}</span>
							</div>
							<div class="info-row">
								<span class="info-row-label">Setup confirmado</span>
								<span class="info-row-value">{iv.state?.setup_confirmed ? 'Sim' : 'Não'}</span>
							</div>
							{#if iv.state?.conversation_summary}
								<div class="info-row summary-row">
									<span class="info-row-label">Resumo da conversa</span>
									<span class="info-row-value">{iv.state.conversation_summary}</span>
								</div>
							{/if}
						</div>
					</div>

				{:else if activeTab === 'documentos'}
					<div class="tab-content">
						<div class="section-title">Documentos ({detail.documents.length})</div>
						{#if detail.documents.length === 0}
							<div class="empty-tab">Nenhum documento enviado nesta entrevista.</div>
						{:else}
							<div class="docs-list">
								{#each detail.documents as doc (doc.id)}
									<div class="doc-row">
										<div class="doc-info">
											<span class="doc-name">{doc.filename}</span>
											<span class="doc-meta">
												<span class="mime-badge">{mimeLabel(doc.mime_type)}</span>
												<span class="muted">{fmtDate(doc.created_at)}</span>
												<span
													class="status-dot"
													class:dot-ok={doc.status === 'completed'}
													class:dot-fail={doc.status === 'failed'}
													class:dot-pending={doc.status === 'pending'}
												>{doc.status}</span>
											</span>
										</div>
										<button class="download-btn" onclick={() => downloadDocument(doc.id)}>
											↓ Download
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if activeTab === 'mensagens'}
					<div class="tab-content">
						<div class="section-title">
							Conversa
							<span class="muted" style="font-weight:400;font-size:0.8rem">
								({detail.messageTotal} mensagens)
							</span>
						</div>

						{#if detail.messageTotal > detail.messages.length}
							<button
								class="load-more-btn"
								disabled={loadingMoreMessages}
								onclick={loadMoreMessages}
							>
								{loadingMoreMessages ? 'Carregando…' : '↑ Carregar mensagens anteriores'}
							</button>
						{/if}

						<div class="messages">
							{#each detail.messages as msg (msg.id)}
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

				{:else if activeTab === 'vetores'}
					<div class="tab-content">
						<div class="section-title">Vetores ({detail.knowledgeVectors.length})</div>
						{#if detail.knowledgeVectors.length === 0}
							<div class="empty-tab">
								<div class="empty-icon">∅</div>
								<div>Nenhum vetor gerado ainda.</div>
								<div class="muted" style="font-size:0.8rem;margin-top:0.25rem">
									Vetores são criados após a estimativa ser concluída com sucesso.
								</div>
							</div>
						{:else}
							<div class="vectors-list">
								{#each detail.knowledgeVectors as v (v.id)}
									<div class="vector-row">
										<div class="vector-meta">
											<span class="mime-badge">{v.source_type}</span>
											<span class="muted">{fmtDate(v.created_at)}</span>
										</div>
										<div class="vector-content">{v.content.slice(0, 200)}{v.content.length > 200 ? '…' : ''}</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if activeTab === 'estimativa' && detail.estimate}
					<div class="tab-content">
						<div class="section-title">Estimativa</div>
						<div class="info-list">
							<div class="info-row">
								<span class="info-row-label">ID</span>
								<span class="info-row-value mono">{detail.estimate.id}</span>
							</div>
							<div class="info-row">
								<span class="info-row-label">Status</span>
								<span class="info-row-value">
									<span class="badge {statusBadgeClass(detail.estimate.status)}">{detail.estimate.status}</span>
								</span>
							</div>
							<div class="info-row">
								<span class="info-row-label">Criada em</span>
								<span class="info-row-value">{fmtDate(detail.estimate.created_at)}</span>
							</div>
						</div>
					</div>

				{:else if activeTab === 'pipeline' && detail.estimate}
					{@const steps = (detail.estimate.agent_steps ?? []) as AgentStep[]}
					<div class="tab-content">
						<div class="pipeline-header">
							<div class="section-title">Pipeline de Agentes</div>
							<div class="pipeline-actions">
								{#if rerunMsg}
									<span class="pipeline-msg">{rerunMsg}</span>
								{/if}
								<button
									class="btn-rerun"
									onclick={() => triggerRerun(iv.id)}
									disabled={rerunning || ['pending','running'].includes(detail.estimate.status)}
								>
									{rerunning ? 'Iniciando…' : 'Re-run Pipeline'}
								</button>
							</div>
						</div>

						{#if steps.length === 0}
							<div class="empty-tab">Nenhum dado de agente disponível. Execute ou re-run o pipeline.</div>
						{:else}
							<div class="pipeline-steps">
								{#each steps as step (step.agent_key)}
									<div class="pipeline-step {stepStatusClass(step.status)}">
										<div
											class="step-header"
											role="button"
											tabindex="0"
											onclick={() => loadAgentOutput(iv.id, step.agent_key)}
											onkeydown={(e) => e.key === 'Enter' && loadAgentOutput(iv.id, step.agent_key)}
										>
											<div class="step-left">
												<span class="step-dot"></span>
												<span class="step-name">{AGENT_LABELS[step.agent_key] ?? step.agent_key}</span>
												<span class="step-key muted">{step.agent_key}</span>
											</div>
											<div class="step-right">
												{#if step.duration_s}
													<span class="step-duration">{step.duration_s.toFixed(1)}s</span>
												{/if}
												<span class="badge {step.status === 'done' ? 'badge-success' : step.status === 'failed' ? 'badge-error' : step.status === 'running' ? 'badge-info' : 'badge-neutral'}">{step.status}</span>
											</div>
										</div>
										{#if step.error}
											<div class="step-error">{step.error}</div>
										{/if}
										{#if agentOutputKey === step.agent_key}
											<div class="step-output">
												{#if loadingAgentOutput}
													<span class="muted">Carregando output…</span>
												{:else if agentOutputData}
													<pre class="output-json">{JSON.stringify(agentOutputData, null, 2)}</pre>
												{:else}
													<span class="muted">Output não disponível</span>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						{#if detail.estimateRuns.length > 0}
							<div class="section-title" style="margin-top:1.5rem">Histórico de Runs</div>
							<div class="runs-list">
								{#each detail.estimateRuns as run (run.id)}
									<div class="run-row">
										<span class="badge {statusBadgeClass(run.status)}">{run.status}</span>
										<span class="muted">{run.llm_model ?? '—'}</span>
										{#if run.total_duration_s}
											<span class="muted">{run.total_duration_s.toFixed(1)}s</span>
										{/if}
										<span class="muted">{fmtDate(run.created_at)}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if activeTab === 'projeto-gerado' && detail.project}
					<div class="tab-content">
						<div class="section-title">Projeto</div>
						<div class="info-list">
							<div class="info-row">
								<span class="info-row-label">Nome</span>
								<span class="info-row-value">{detail.project.name ?? '—'}</span>
							</div>
							<div class="info-row">
								<span class="info-row-label">ID</span>
								<span class="info-row-value mono">{detail.project.id}</span>
							</div>
						</div>
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

	.cockpit {
		display: grid;
		grid-template-columns: 360px 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	/* ── List panel ─────────────────────────────────── */

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

	.status-select {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		color: #d1d5db;
		font-size: 0.8125rem;
		padding: 0.4rem 0.5rem;
		outline: none;
		cursor: pointer;
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
		margin-bottom: 0.4rem;
		overflow: hidden;
		white-space: nowrap;
	}

	.item-bar {
		height: 3px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		margin-bottom: 0.25rem;
		overflow: hidden;
	}

	.maturity-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s;
	}

	.item-date {
		font-size: 0.7rem;
		color: var(--color-neutral-600, #4b5563);
	}

	.empty {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
	}

	/* ── Detail panel ───────────────────────────────── */

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

	.maturity-block {
		text-align: center;
		min-width: 60px;
	}

	.maturity-pct {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}

	/* ── Tab cards ──────────────────────────────────── */

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

	/* ── Domains ────────────────────────────────────── */

	.section {
		margin-bottom: 1.25rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.6rem;
	}

	.domains {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.domain-row {
		display: grid;
		grid-template-columns: 100px 1fr 50px 20px;
		align-items: center;
		gap: 0.5rem;
	}

	.domain-name {
		font-size: 0.8rem;
		color: #d1d5db;
	}

	.domain-bar-wrap {
		height: 6px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 3px;
		overflow: hidden;
	}

	.domain-bar-fill {
		height: 100%;
		background: var(--color-primary-500, #6366f1);
		border-radius: 3px;
	}

	.domain-count {
		font-size: 0.75rem;
		text-align: right;
	}

	.vital-ok {
		color: var(--color-success, #10b981);
		font-size: 0.75rem;
	}

	.vital-no {
		color: var(--color-error, #ef4444);
		font-size: 0.75rem;
	}

	/* ── Tab content ────────────────────────────────── */

	.tab-content {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 1rem 1.125rem;
		margin-top: 0.5rem;
	}

	.tab-content .section-title {
		margin-bottom: 0.75rem;
	}

	/* Info list (single column) */
	.info-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.info-row {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.info-row:last-child {
		border-bottom: none;
	}

	.info-row-label {
		font-size: 0.75rem;
		color: var(--color-neutral-500, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 110px;
		flex-shrink: 0;
	}

	.info-row-value {
		font-size: 0.875rem;
		color: #f9fafb;
		word-break: break-all;
	}

	.summary-row {
		align-items: flex-start;
	}

	.mono {
		font-family: monospace;
		font-size: 0.8rem;
		color: #a5f3fc;
	}

	/* Docs */
	.docs-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.doc-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		padding: 0.6rem 0.75rem;
	}

	.doc-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.doc-name {
		font-size: 0.875rem;
		color: #f9fafb;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.doc-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
	}

	.mime-badge {
		background: rgba(99, 102, 241, 0.15);
		color: var(--color-primary-500, #6366f1);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.status-dot {
		font-size: 0.7rem;
	}

	.dot-ok { color: var(--color-success, #10b981); }
	.dot-fail { color: var(--color-error, #ef4444); }
	.dot-pending { color: var(--color-warning, #f59e0b); }

	.download-btn {
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 6px;
		color: var(--color-primary-500, #6366f1);
		font-size: 0.8rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.download-btn:hover {
		background: rgba(99, 102, 241, 0.22);
	}

	/* Empty tab state */
	.empty-tab {
		text-align: center;
		padding: 2rem 1rem;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.875rem;
	}

	.empty-icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
		opacity: 0.4;
	}

	/* Vectors */
	.vectors-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.vector-row {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		padding: 0.6rem 0.75rem;
	}

	.vector-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.3rem;
	}

	.vector-content {
		font-size: 0.8rem;
		color: #9ca3af;
		line-height: 1.5;
	}

	/* Messages */
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

	/* badges */
	.badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.badge-success {
		background: color-mix(in srgb, var(--color-success, #10b981) 15%, transparent);
		color: var(--color-success, #10b981);
	}

	.badge-info {
		background: color-mix(in srgb, #60a5fa 15%, transparent);
		color: #60a5fa;
	}

	.badge-error {
		background: color-mix(in srgb, var(--color-error, #ef4444) 15%, transparent);
		color: var(--color-error, #ef4444);
	}

	.badge-neutral {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-neutral-500, #6b7280);
	}

	.muted {
		color: var(--color-neutral-500, #6b7280);
	}

	/* ── Pipeline tab ── */

	.pipeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.pipeline-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.pipeline-msg {
		font-size: 0.8125rem;
		color: var(--color-success, #10b981);
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

	.btn-rerun:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pipeline-steps {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pipeline-step {
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 8px;
		overflow: hidden;
	}

	.step-done { border-left: 3px solid var(--color-success, #10b981); }
	.step-failed { border-left: 3px solid var(--color-error, #ef4444); }
	.step-running { border-left: 3px solid var(--color-primary-500, #6366f1); }
	.step-pending { border-left: 3px solid rgba(255,255,255,0.12); }

	.step-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.75rem;
		cursor: pointer;
		background: rgba(255, 255, 255, 0.02);
	}

	.step-header:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.step-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.step-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}

	.step-done .step-dot { color: var(--color-success, #10b981); }
	.step-failed .step-dot { color: var(--color-error, #ef4444); }
	.step-running .step-dot { color: var(--color-primary-500, #6366f1); }
	.step-pending .step-dot { color: rgba(255,255,255,0.25); }

	.step-name {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f9fafb;
	}

	.step-key {
		font-family: monospace;
		font-size: 0.7rem;
	}

	.step-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.step-duration {
		font-size: 0.75rem;
		font-family: monospace;
		color: var(--color-neutral-400, #9ca3af);
	}

	.step-error {
		padding: 0.4rem 0.75rem;
		font-size: 0.75rem;
		color: var(--color-error, #ef4444);
		background: rgba(239, 68, 68, 0.08);
		border-top: 1px solid rgba(239, 68, 68, 0.15);
	}

	.step-output {
		padding: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		background: var(--color-dark-bg, #0f1117);
	}

	.output-json {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		color: #d1d5db;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 400px;
		overflow-y: auto;
		margin: 0;
	}

	.runs-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.run-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.6rem;
		background: rgba(255, 255, 255, 0.02);
		border-radius: 6px;
		font-size: 0.8125rem;
	}
</style>
