<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button, StatusBadge, MetricDisplay, ProgressBar } from '@oute/ui';
	import '@oute/ui/theme.css';
	import type { EstimateResult } from '$lib/types/estimate';
	import { AGENT_LABELS, AGENT_KEYS } from '$lib/types/estimate';
	import type { AgentStep } from '$lib/types/estimate';

	let { data } = $props();

	let estimate = $derived(data.estimate);
	let project = $derived(data.project ?? null);
	let result = $derived(estimate.result as EstimateResult | null);
	let isApproving = $state(false);
	let projectName = $state('');
	let isRerunning = $state(false);
	let rerunError = $state('');

	let selectedScenario = $state('moderado');
	let pollTimer = $state<ReturnType<typeof setInterval> | null>(null);
	let elapsedSeconds = $state(0);
	let elapsedTimer = $state<ReturnType<typeof setInterval> | null>(null);

	const displaySteps = $derived(
		AGENT_KEYS.map((key) => {
			const found = (estimate.agent_steps ?? []).find((s: AgentStep) => s.agent_key === key);
			return (found ?? { agent_key: key, status: 'pending', duration_s: null, started_at: null, finished_at: null, output_preview: null, error: null }) as AgentStep;
		})
	);

	const firstFailedAgent = $derived(
		displaySteps.find((s) => s.status === 'failed')?.agent_key ?? null
	);

	$effect(() => {
		if (['pending', 'running'].includes(estimate.status)) {
			pollTimer = setInterval(async () => {
				await invalidateAll();
			}, 5000);
			elapsedTimer = setInterval(() => { elapsedSeconds += 1; }, 1000);
		}
		return () => {
			if (pollTimer) clearInterval(pollTimer);
			if (elapsedTimer) clearInterval(elapsedTimer);
		};
	});

	$effect(() => {
		if (!['pending', 'running'].includes(estimate.status)) {
			if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
			if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
		}
	});

	async function handleRerun(fromAgent?: string) {
		isRerunning = true;
		rerunError = '';
		try {
			const body: Record<string, string> = {};
			if (fromAgent) body.from_agent = fromAgent;
			const res = await fetch(`/api/estimates/${estimate.id}/rerun`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({})) as { error?: string };
				throw new Error(err?.error || `Erro ${res.status}`);
			}
			elapsedSeconds = 0;
			await invalidateAll();
		} catch (e) {
			rerunError = e instanceof Error ? e.message : 'Tente novamente';
			isRerunning = false;
		}
	}

	async function handleApprove() {
		isApproving = true;
		try {
			const res = await fetch(`/api/estimates/${estimate.id}/approve`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: projectName || 'Novo Projeto',
					scenario: selectedScenario,
				}),
			});
			if (!res.ok) throw new Error('Failed to approve');
			const data = await res.json();
			goto(`/projects/${data.project_id}`);
		} catch {
			isApproving = false;
		}
	}

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('pt-BR', {
			style: 'currency',
			currency: 'BRL',
			maximumFractionDigits: 0,
		}).format(value);
	}

	function fmtDuration(s: number | null): string {
		if (s === null) return '';
		if (s < 60) return `${s.toFixed(0)}s`;
		return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
	}
</script>

<svelte:head>
	<title>Estimativa — oute.pro</title>
</svelte:head>

<div class="estimate-page">
	<header class="page-header">
		<button class="back-btn" onclick={() => goto(`/interviews/${estimate.interview_id}`)}>← Entrevista</button>
		<div class="header-info">
			<h1>Estimativa</h1>
			<StatusBadge status={estimate.status} />
		</div>
		{#if project}
			<a class="project-link-header" href="/projects/{project.id}">Ver Projeto →</a>
		{/if}
	</header>

	{#if estimate.status === 'pending_approval'}
		<div class="loading-state">
			<div class="approval-icon">⏳</div>
			<h2>Estimativa solicitada</h2>
			<p>Sua solicitação foi recebida e está aguardando análise da nossa equipe.<br>Você será notificado quando o processo iniciar.</p>
			<Button variant="ghost" onclick={() => goto(`/interviews/${estimate.interview_id}`)}>
				Voltar à Entrevista
			</Button>
		</div>

	{:else if ['pending', 'running'].includes(estimate.status)}
		<div class="pipeline-state">
			<div class="pipeline-header">
				<h2>Gerando estimativa…</h2>
				<span class="elapsed-chip">⏱ {elapsedSeconds}s</span>
			</div>
			<p class="pipeline-hint">Nossos especialistas de IA estão analisando seu projeto.<br>Esse processo pode levar alguns minutos.</p>
			<div class="agent-stepper">
				{#each displaySteps as step, i (step.agent_key)}
					<div class="as-row as-{step.status}">
						<div class="as-track">
							<div class="as-line" class:as-line-hidden={i === 0}></div>
							<div class="as-circle">
								{#if step.status === 'done'}
									<span>✓</span>
								{:else if step.status === 'failed'}
									<span>✕</span>
								{:else if step.status === 'running'}
									<div class="as-pulse"></div>
								{:else}
									<div class="as-dot"></div>
								{/if}
							</div>
							<div class="as-line" class:as-line-hidden={i === displaySteps.length - 1}></div>
						</div>
						<div class="as-content">
							<span class="as-label">{AGENT_LABELS[step.agent_key] ?? step.agent_key}</span>
							{#if step.status === 'running'}
								<span class="as-time">em andamento…</span>
							{:else if step.status === 'done' && step.duration_s != null}
								<span class="as-time">{step.duration_s.toFixed(1)}s</span>
							{:else if step.status === 'failed'}
								<span class="as-time as-err">falhou</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

	{:else if estimate.status === 'failed'}
		<div class="error-state">
			<h2>Erro na estimativa</h2>
			<p>Ocorreu um problema ao gerar sua estimativa. Nossa equipe foi notificada e irá verificar.</p>
			{#if estimate.agent_steps && estimate.agent_steps.length > 0}
				<div class="agent-stepper agent-stepper-compact">
					{#each displaySteps as step, i (step.agent_key)}
						<div class="as-row as-{step.status}">
							<div class="as-track">
								<div class="as-line" class:as-line-hidden={i === 0}></div>
								<div class="as-circle">
									{#if step.status === 'done'}
										<span>✓</span>
									{:else if step.status === 'failed'}
										<span>✕</span>
									{:else if step.status === 'running'}
										<div class="as-pulse"></div>
									{:else}
										<div class="as-dot"></div>
									{/if}
								</div>
								<div class="as-line" class:as-line-hidden={i === displaySteps.length - 1}></div>
							</div>
							<div class="as-content">
								<span class="as-label">{AGENT_LABELS[step.agent_key] ?? step.agent_key}</span>
								{#if step.status === 'done' && step.duration_s != null}
									<span class="as-time">{step.duration_s.toFixed(1)}s</span>
								{:else if step.status === 'failed' && step.error}
									<span class="as-time as-err">{step.error}</span>
								{:else if step.status === 'failed'}
									<span class="as-time as-err">falhou</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
			<div class="rerun-actions">
				<Button onclick={() => handleRerun()} disabled={isRerunning}>
					{isRerunning ? 'Reiniciando…' : '↺ Tentar novamente'}
				</Button>
				{#if firstFailedAgent && firstFailedAgent !== AGENT_KEYS[0]}
					<Button variant="ghost" onclick={() => handleRerun(firstFailedAgent)} disabled={isRerunning}>
						Continuar a partir de "{AGENT_LABELS[firstFailedAgent]}"
					</Button>
				{/if}
				{#if rerunError}
					<span class="rerun-error">{rerunError}</span>
				{/if}
			</div>
			<Button variant="ghost" onclick={() => goto(`/interviews/${estimate.interview_id}`)}>
				Voltar à Entrevista
			</Button>
		</div>

	{:else if result}
		<div class="result-content">
			<!-- Executive Summary -->
			<section class="section">
				<h2>Resumo Executivo</h2>
				<p class="summary-text">{result.executive_summary}</p>
			</section>

			<!-- Cost Scenarios -->
			{#if result.cost_scenarios?.length > 0}
				<section class="section">
					<h2>Cenários de Custo</h2>
					<div class="scenarios-grid">
						{#each result.cost_scenarios as scenario (scenario.name)}
							<div class="scenario-card">
								<h3>{scenario.name}</h3>
								<p class="scenario-desc">{scenario.description}</p>
								<div class="scenario-metrics">
									<MetricDisplay label="Custo Total" value={formatCurrency(scenario.total_cost)} variant="highlight" />
									<MetricDisplay label="Duração" value={scenario.duration_weeks} unit="semanas" />
									<MetricDisplay label="Equipe" value={scenario.team_size} unit="pessoas" />
									<MetricDisplay label="Horas" value={Math.round(scenario.total_hours)} unit="h" />
								</div>
								<ProgressBar
									value={Math.round(scenario.confidence * 100)}
									label="Confiança"
									variant={scenario.confidence >= 0.7 ? 'success' : scenario.confidence >= 0.4 ? 'warning' : 'error'}
								/>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Architecture -->
			{#if result.architecture_overview}
				<section class="section">
					<h2>Arquitetura</h2>
					<p class="architecture-text">{result.architecture_overview}</p>
				</section>
			{/if}

			<!-- Milestones -->
			{#if result.milestones?.length > 0}
				<section class="section">
					<h2>Milestones</h2>
					<div class="milestones-list">
						{#each result.milestones as milestone, i (milestone.name)}
							<div class="milestone-card">
								<div class="milestone-header">
									<span class="milestone-number">{i + 1}</span>
									<div>
										<h3>{milestone.name}</h3>
										<span class="milestone-duration">{milestone.duration_weeks} semanas</span>
									</div>
								</div>
								<p>{milestone.description}</p>
								{#if milestone.deliverables.length > 0}
									<div class="deliverables">
										<strong>Entregáveis:</strong>
										<ul>
											{#each milestone.deliverables as d (d)}
												<li>{d}</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Tech Recommendations -->
			{#if result.tech_recommendations?.length > 0}
				<section class="section">
					<h2>Recomendações Técnicas</h2>
					<div class="tech-grid">
						{#each result.tech_recommendations as rec (rec.category + rec.technology)}
							<div class="tech-card">
								<span class="tech-category">{rec.category}</span>
								<h3>{rec.technology}</h3>
								<p>{rec.justification}</p>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Risks -->
			{#if result.risks?.length > 0}
				<section class="section">
					<h2>Riscos</h2>
					<div class="risks-list">
						{#each result.risks as risk (risk.description)}
							<div class="risk-card risk-{risk.impact}">
								<div class="risk-header">
									<span class="risk-impact">{risk.impact}</span>
									<span class="risk-probability">Prob: {risk.probability}</span>
								</div>
								<p class="risk-desc">{risk.description}</p>
								<p class="risk-mitigation"><strong>Mitigação:</strong> {risk.mitigation}</p>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Actions -->
			{#if estimate.status === 'done' && !estimate.approved_at}
				<section class="section approve-section">
					<h2>Aprovar e Criar Projeto</h2>
					<div class="approve-form">
						<label class="form-field">
							<span>Nome do Projeto</span>
							<input
								type="text"
								bind:value={projectName}
								placeholder="Ex: App de Delivery, CRM Interno..."
							/>
						</label>
						{#if result.cost_scenarios?.length > 1}
							<label class="form-field">
								<span>Cenário de Custo</span>
								<select bind:value={selectedScenario}>
									{#each result.cost_scenarios as scenario (scenario.name)}
										<option value={scenario.name}>{scenario.name} — {formatCurrency(scenario.total_cost)}</option>
									{/each}
								</select>
							</label>
						{/if}
						<div class="approve-actions">
							<Button onclick={handleApprove} disabled={isApproving || !projectName.trim()} size="lg">
								{isApproving ? 'Criando projeto...' : 'Aprovar e Criar Projeto'}
							</Button>
							<Button variant="ghost" onclick={() => goto(`/interviews/${estimate.interview_id}`)}>
								Voltar à Entrevista
							</Button>
						</div>
					</div>
				</section>
			{:else if estimate.approved_at}
				<div class="approved-banner">
					Estimativa aprovada. Projeto criado com sucesso.
					{#if project}
						<a class="project-link-banner" href="/projects/{project.id}">Ver Projeto →</a>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>


<style>
	.estimate-page {
		min-height: 100vh;
		background: var(--color-dark-bg, #0f1117);
		color: var(--color-neutral-300, #d1d5db);
		padding: 2rem;
		max-width: 960px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 2rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.page-header .header-info {
		flex: 1;
	}

	.project-link-header {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-primary-500, #6366f1);
		text-decoration: none;
		padding: 0.35rem 0.75rem;
		border: 1px solid rgba(99, 102, 241, 0.4);
		border-radius: 6px;
		transition: background 0.15s;
	}

	.project-link-header:hover {
		background: rgba(99, 102, 241, 0.1);
	}

	.back-btn {
		background: none;
		border: none;
		color: var(--color-primary-500, #6366f1);
		cursor: pointer;
		font-size: 0.875rem;
		padding: 0;
		margin-bottom: 0.75rem;
	}

	.header-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-info h1 {
		font-size: 1.5rem;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
	}

	/* ── Loading state ── */
	.loading-state, .error-state {
		text-align: center;
		padding: 3rem 2rem;
	}

	.loading-state h2, .error-state h2 {
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 0.5rem;
	}

	.loading-state p, .error-state p {
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 2rem;
	}

	.approval-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	/* ── Re-run actions ── */
	.rerun-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.rerun-error {
		width: 100%;
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-error, #ef4444);
	}

	/* ── Pipeline stepper ── */
	.pipeline-state {
		padding: 2rem 0;
		max-width: 480px;
		margin: 0 auto;
	}

	.pipeline-header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.pipeline-header h2 {
		color: rgba(255, 255, 255, 0.9);
		margin: 0;
		font-size: 1.25rem;
	}

	.elapsed-chip {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.35);
		background: rgba(255, 255, 255, 0.05);
		padding: 0.2rem 0.6rem;
		border-radius: 20px;
	}

	.pipeline-hint {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.45);
		margin-bottom: 2rem;
		line-height: 1.6;
	}

	.agent-stepper {
		display: flex;
		flex-direction: column;
	}

	.agent-stepper-compact {
		margin: 1.5rem auto;
		max-width: 400px;
	}

	.as-row {
		display: flex;
		align-items: stretch;
		gap: 0.875rem;
		min-height: 52px;
	}

	.as-track {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
		width: 28px;
	}

	.as-line {
		flex: 1;
		width: 2px;
		background: rgba(255, 255, 255, 0.1);
		min-height: 8px;
	}

	.as-line-hidden {
		background: transparent;
	}

	.as-circle {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: 0.8125rem;
		font-weight: 700;
		border: 2px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		color: rgba(255, 255, 255, 0.5);
	}

	.as-done .as-circle {
		background: var(--color-success, #10b981);
		border-color: var(--color-success, #10b981);
		color: white;
	}

	.as-running .as-circle {
		background: var(--color-primary-500, #6366f1);
		border-color: var(--color-primary-500, #6366f1);
		color: white;
	}

	.as-failed .as-circle {
		background: var(--color-error, #ef4444);
		border-color: var(--color-error, #ef4444);
		color: white;
	}

	.as-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
	}

	.as-pulse {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: white;
		animation: pulse-dot 1.2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.7); }
	}

	.as-content {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0.25rem 0;
		gap: 0.125rem;
	}

	.as-label {
		font-size: 0.9375rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.75);
		line-height: 1.3;
	}

	.as-running .as-label {
		color: rgba(255, 255, 255, 0.95);
	}

	.as-done .as-label {
		color: rgba(255, 255, 255, 0.6);
	}

	.as-failed .as-label {
		color: var(--color-error, #ef4444);
	}

	.as-time {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.35);
	}

	.as-err {
		color: var(--color-error, #ef4444);
		opacity: 0.8;
	}

	.as-done .as-line {
		background: color-mix(in srgb, var(--color-success, #10b981) 40%, rgba(255,255,255,0.1));
	}

	/* ── Result sections ── */
	.section { margin-bottom: 2.5rem; }

	.section h2 {
		font-size: 1.25rem;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.summary-text, .architecture-text {
		line-height: 1.7;
		color: rgba(255, 255, 255, 0.7);
		white-space: pre-line;
	}

	.scenarios-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	.scenario-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 1.25rem;
	}

	.scenario-card h3 {
		text-transform: capitalize;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 0.25rem;
	}

	.scenario-desc {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 1rem;
	}

	.scenario-metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.milestones-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.milestone-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 1rem;
	}

	.milestone-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.milestone-number {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--color-primary-500, #6366f1);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.milestone-header h3 {
		margin: 0;
		color: rgba(255, 255, 255, 0.9);
		font-size: 1rem;
	}

	.milestone-duration {
		font-size: 0.75rem;
		color: var(--color-primary-500, #6366f1);
	}

	.milestone-card p {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.deliverables {
		margin-top: 0.5rem;
		font-size: 0.875rem;
	}

	.deliverables ul {
		margin: 0.25rem 0 0;
		padding-left: 1.25rem;
	}

	.deliverables li { color: rgba(255, 255, 255, 0.6); }

	.tech-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.tech-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 1rem;
	}

	.tech-category {
		font-size: 0.75rem;
		color: var(--color-primary-500, #6366f1);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.tech-card h3 {
		color: rgba(255, 255, 255, 0.9);
		margin: 0.25rem 0 0.5rem;
		font-size: 1rem;
	}

	.tech-card p {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.risks-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.risk-card {
		background: var(--color-dark-surface, #1a1d27);
		border-radius: 8px;
		padding: 1rem;
		border-left: 3px solid;
	}

	.risk-high { border-left-color: var(--color-error, #ef4444); }
	.risk-medium { border-left-color: var(--color-warning, #f59e0b); }
	.risk-low { border-left-color: var(--color-success, #10b981); }

	.risk-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.risk-impact {
		text-transform: uppercase;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.risk-probability {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.risk-desc {
		font-size: 0.9375rem;
		color: rgba(255, 255, 255, 0.8);
		margin-bottom: 0.5rem;
	}

	.risk-mitigation {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.approve-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.form-field span {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.form-field input, .form-field select {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.625rem 0.875rem;
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.9375rem;
		font-family: inherit;
		outline: none;
	}

	.form-field input:focus, .form-field select:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	.approve-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding-top: 0.5rem;
	}

	.approved-banner {
		padding: 1rem 1.25rem;
		background: color-mix(in srgb, var(--color-success, #10b981) 15%, transparent);
		color: var(--color-success, #10b981);
		border-radius: 8px;
		font-weight: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.project-link-banner {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-success, #10b981);
		text-decoration: none;
		padding: 0.25rem 0.75rem;
		border: 1px solid rgba(16, 185, 129, 0.5);
		border-radius: 6px;
		transition: background 0.15s;
	}

	.project-link-banner:hover {
		background: rgba(16, 185, 129, 0.15);
	}

	/* ── Re-run modal ── */
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
		max-width: 400px;
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
		align-items: center;
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
</style>
