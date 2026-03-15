<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button, StatusBadge, MetricDisplay, ProgressBar } from '@oute/ui';
	import '@oute/ui/theme.css';
	import type { EstimateResult } from '$lib/types/estimate';

	let { data } = $props();

	let estimate = $derived(data.estimate);
	let result = $derived(estimate.result as EstimateResult | null);
	let isApproving = $state(false);
	let projectName = $state('');
	let selectedScenario = $state('moderado');
	let pollTimer = $state<ReturnType<typeof setInterval> | null>(null);

	$effect(() => {
		if (['pending', 'running'].includes(estimate.status)) {
			pollTimer = setInterval(async () => {
				await invalidateAll();
			}, 5000);
		}

		return () => {
			if (pollTimer) clearInterval(pollTimer);
		};
	});

	$effect(() => {
		if (!['pending', 'running'].includes(estimate.status) && pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	});

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
</script>

<svelte:head>
	<title>Estimativa — oute.me</title>
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
			<div class="spinner"></div>
			<h2>Gerando estimativa...</h2>
			<p>Nossos agentes de IA estão analisando seu projeto. Isso pode levar alguns minutos.</p>
			<div class="pipeline-steps">
				<ProgressBar value={estimate.status === 'pending' ? 10 : 50} label="Progresso" variant="primary" />
			</div>
		</div>
	{:else if estimate.status === 'failed'}
		<div class="error-state">
			<h2>Erro na estimativa</h2>
			<p>Ocorreu um erro ao gerar a estimativa. Tente novamente.</p>
			<Button onclick={() => goto(`/interviews/${estimate.interview_id}`)}>
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

	.loading-state,
	.error-state {
		text-align: center;
		padding: 4rem 2rem;
	}

	.loading-state h2,
	.error-state h2 {
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 0.5rem;
	}

	.loading-state p,
	.error-state p {
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 2rem;
	}

	.pipeline-steps {
		max-width: 400px;
		margin: 0 auto;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--color-primary-500, #6366f1);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1.5rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.section {
		margin-bottom: 2.5rem;
	}

	.section h2 {
		font-size: 1.25rem;
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.summary-text,
	.architecture-text {
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

	.deliverables li {
		color: rgba(255, 255, 255, 0.6);
	}

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

	.risk-high {
		border-left-color: var(--color-error, #ef4444);
	}

	.risk-medium {
		border-left-color: var(--color-warning, #f59e0b);
	}

	.risk-low {
		border-left-color: var(--color-success, #10b981);
	}

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

	.form-field input,
	.form-field select {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.625rem 0.875rem;
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.9375rem;
		font-family: inherit;
		outline: none;
	}

	.form-field input:focus,
	.form-field select:focus {
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
