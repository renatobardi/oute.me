<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button, StatusBadge, MetricDisplay, ProgressBar } from '@oute/ui';
	import '@oute/ui/theme.css';
	import { auth } from '$lib/firebase';
	import type { EstimateResult, AgentStep } from '$lib/types/estimate';
	import { AGENT_KEYS, AGENT_LABELS } from '$lib/types/estimate';

	let { data } = $props();

	let estimate = $derived(data.estimate);
	let result = $derived(estimate.result as EstimateResult | null);
	let agentSteps = $derived((estimate.agent_steps ?? []) as AgentStep[]);
	let isApproving = $state(false);
	let isRerunning = $state(false);
	let projectName = $state('');
	let selectedScenario = $state('moderado');
	let pollTimer = $state<ReturnType<typeof setInterval> | null>(null);
	let elapsedSeconds = $state(0);
	let elapsedTimer = $state<ReturnType<typeof setInterval> | null>(null);

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

	// Build stepper state from agentSteps (or defaults when pipeline is still running)
	const stepperSteps = $derived(
		AGENT_KEYS.map((key, i) => {
			const found = agentSteps.find((s) => s.agent_key === key);
			if (found) return found;
			// Pipeline running but no step data yet — all pending
			return {
				agent_key: key,
				status: 'pending',
				started_at: null,
				finished_at: null,
				duration_s: null,
				output_preview: null,
				error: null,
			} satisfies AgentStep;
		})
	);

	const doneCount = $derived(stepperSteps.filter((s) => s.status === 'done').length);
	const progressPct = $derived(Math.round((doneCount / AGENT_KEYS.length) * 100));

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

	async function handleRerun() {
		isRerunning = true;
		elapsedSeconds = 0;
		try {
			const token = await auth.currentUser?.getIdToken(false);
			const res = await fetch(`/api/estimates/${estimate.id}/rerun`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
			});
			if (!res.ok) throw new Error('Rerun failed');
			await invalidateAll();
		} catch {
			isRerunning = false;
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
		<button class="back-btn" onclick={() => goto('/interviews')}>← Voltar</button>
		<div class="header-info">
			<h1>Estimativa</h1>
			<StatusBadge status={estimate.status} />
		</div>
	</header>

	{#if ['pending', 'running'].includes(estimate.status)}
		<div class="loading-state">
			<h2>Gerando estimativa…</h2>
			<p>Nossos agentes de IA estão analisando seu projeto.</p>

			<!-- Agent stepper -->
			<div class="stepper">
				{#each stepperSteps as step, i (step.agent_key)}
					<div class="step" class:step-done={step.status === 'done'} class:step-failed={step.status === 'failed'} class:step-running={step.status === 'running'}>
						<div class="step-icon">
							{#if step.status === 'done'}✓
							{:else if step.status === 'failed'}✗
							{:else if step.status === 'running' || (step.status === 'pending' && i === doneCount)}
								<span class="pulse-dot"></span>
							{:else}
								<span class="step-num">{i + 1}</span>
							{/if}
						</div>
						<div class="step-info">
							<span class="step-name">{AGENT_LABELS[step.agent_key] ?? step.agent_key}</span>
							{#if step.status === 'done' && step.duration_s !== null}
								<span class="step-duration">{fmtDuration(step.duration_s)}</span>
							{:else if step.status === 'failed' && step.error}
								<span class="step-error">{step.error.slice(0, 60)}</span>
							{:else if (step.status === 'running' || (step.status === 'pending' && i === doneCount))}
								<span class="step-running-label">{elapsedSeconds}s…</span>
							{/if}
						</div>
					</div>
					{#if i < AGENT_KEYS.length - 1}
						<div class="step-connector" class:connector-done={i < doneCount}></div>
					{/if}
				{/each}
			</div>

			<div class="progress-wrap">
				<ProgressBar value={progressPct} label={`${doneCount} de ${AGENT_KEYS.length} agentes`} variant="primary" />
			</div>
		</div>

	{:else if estimate.status === 'failed'}
		<div class="error-state">
			<h2>Erro na estimativa</h2>
			<p>Ocorreu um erro ao gerar a estimativa.</p>

			{#if agentSteps.length > 0}
				<div class="fail-steps">
					{#each agentSteps as step (step.agent_key)}
						<div class="fail-step" class:fail-ok={step.status === 'done'} class:fail-err={step.status === 'failed'}>
							<span>{step.status === 'done' ? '✓' : '✗'}</span>
							<span>{AGENT_LABELS[step.agent_key] ?? step.agent_key}</span>
							{#if step.error}<span class="fail-msg">{step.error.slice(0, 80)}</span>{/if}
						</div>
					{/each}
				</div>
			{/if}

			<div class="error-actions">
				<Button onclick={handleRerun} disabled={isRerunning}>
					{isRerunning ? 'Iniciando…' : 'Tentar novamente'}
				</Button>
				<Button variant="ghost" onclick={() => goto(`/interviews/${estimate.interview_id}`)}>
					Voltar à Entrevista
				</Button>
			</div>
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

	.page-header { margin-bottom: 2rem; }

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

	/* ── Pipeline stepper ── */
	.stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0;
		margin: 0 auto 2rem;
		max-width: 820px;
	}

	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		min-width: 100px;
		max-width: 120px;
	}

	.step-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
		font-weight: 700;
		border: 2px solid rgba(255, 255, 255, 0.15);
		background: rgba(255, 255, 255, 0.05);
		color: rgba(255, 255, 255, 0.4);
		transition: all 0.3s;
	}

	.step-done .step-icon {
		background: color-mix(in srgb, var(--color-success, #10b981) 20%, transparent);
		border-color: var(--color-success, #10b981);
		color: var(--color-success, #10b981);
	}

	.step-failed .step-icon {
		background: color-mix(in srgb, var(--color-error, #ef4444) 20%, transparent);
		border-color: var(--color-error, #ef4444);
		color: var(--color-error, #ef4444);
	}

	.step-running .step-icon {
		border-color: var(--color-primary-500, #6366f1);
		animation: pulse-ring 1.5s ease-in-out infinite;
	}

	@keyframes pulse-ring {
		0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
		50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
	}

	.pulse-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--color-primary-500, #6366f1);
		animation: pulse-dot 1s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.7); }
	}

	.step-num {
		font-size: 0.8rem;
		font-weight: 600;
	}

	.step-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}

	.step-name {
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.7);
		text-align: center;
		line-height: 1.3;
	}

	.step-done .step-name { color: rgba(255, 255, 255, 0.9); }

	.step-duration {
		font-size: 0.65rem;
		color: var(--color-success, #10b981);
	}

	.step-running-label {
		font-size: 0.65rem;
		color: var(--color-primary-500, #6366f1);
	}

	.step-error {
		font-size: 0.65rem;
		color: var(--color-error, #ef4444);
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.step-connector {
		flex: 1;
		height: 2px;
		min-width: 12px;
		background: rgba(255, 255, 255, 0.1);
		margin-bottom: 1.5rem;
		transition: background 0.3s;
	}

	.connector-done {
		background: var(--color-success, #10b981);
	}

	.progress-wrap {
		max-width: 400px;
		margin: 0 auto;
	}

	/* ── Error state ── */
	.fail-steps {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-width: 400px;
		margin: 0 auto 1.5rem;
		text-align: left;
	}

	.fail-step {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.8125rem;
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.03);
	}

	.fail-ok { color: var(--color-success, #10b981); }
	.fail-err { color: var(--color-error, #ef4444); }

	.fail-msg {
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.75rem;
		margin-left: auto;
	}

	.error-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 1.5rem;
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
		padding: 1rem;
		background: color-mix(in srgb, var(--color-success, #10b981) 15%, transparent);
		color: var(--color-success, #10b981);
		border-radius: 8px;
		text-align: center;
		font-weight: 500;
	}
</style>
