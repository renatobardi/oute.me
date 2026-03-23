<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { ActivePipeline, FunnelStep } from '$lib/server/admin-dashboard';
	import KpiCard from '$lib/components/admin/dashboard/KpiCard.svelte';
	import ConversionFunnel from '$lib/components/admin/dashboard/ConversionFunnel.svelte';
	import ActivePipelines from '$lib/components/admin/dashboard/ActivePipelines.svelte';
	import AlertsPanel from '$lib/components/admin/dashboard/AlertsPanel.svelte';
	import TokenCostWidget from '$lib/components/admin/dashboard/TokenCostWidget.svelte';

	let { data } = $props();

	let pipelines = $state<ActivePipeline[]>(data.pipelines);
	let funnel = $state<FunnelStep[]>(data.funnel);
	let funnelPeriod = $state(30);
	let _refreshing = $state(false);

	// Polling de pipelines ativos a cada 5s
	$effect(() => {
		const timer = setInterval(refreshPipelines, 5_000);
		return () => clearInterval(timer);
	});

	// SSE para notificações toast
	$effect(() => {
		const es = new EventSource('/api/admin/pipeline-events');
		es.addEventListener('pipeline_done', (e) => {
			showToast('Pipeline concluído!', 'success');
			const ev = JSON.parse(e.data);
			if (ev.interview_id) refreshPipelines();
		});
		es.addEventListener('pipeline_failed', (e) => {
			showToast('Pipeline falhou.', 'error');
			const ev = JSON.parse(e.data);
			if (ev.interview_id) refreshPipelines();
		});
		es.addEventListener('error', () => {
			es.close();
		});
		return () => es.close();
	});

	async function refreshPipelines() {
		try {
			const token = (await auth.currentUser?.getIdToken(false)) ?? '';
			const res = await fetch('/api/admin/dashboard/pipelines', {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) pipelines = await res.json();
		} catch { /* silent */ }
	}

	async function changeFunnelPeriod(p: number) {
		funnelPeriod = p;
		_refreshing = true;
		try {
			const token = (await auth.currentUser?.getIdToken(false)) ?? '';
			const res = await fetch(`/api/admin/dashboard/funnel?period=${p}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) funnel = await res.json();
		} finally {
			_refreshing = false;
		}
	}

	// Toast
	interface Toast { id: number; msg: string; type: 'success' | 'error' }
	let toasts = $state<Toast[]>([]);
	let _toastId = 0;

	function showToast(msg: string, type: Toast['type']) {
		const id = ++_toastId;
		toasts = [...toasts, { id, msg, type }];
		setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 4000);
	}

	// KPI helpers
	const pipelineSuccessRate = $derived(
		data.metrics.estimates.total > 0
			? Math.round((1 - data.metrics.estimates.failure_rate) * 100)
			: 100
	);
	const _avgDuration = $derived(
		data.metrics.estimates.avg_duration_s != null
			? `${Math.round(data.metrics.estimates.avg_duration_s)}s médio`
			: undefined
	);
</script>

<svelte:head>
	<title>Dashboard — oute.pro</title>
</svelte:head>

<!-- Toast notifications -->
<div class="toast-container">
	{#each toasts as toast (toast.id)}
		<div class="toast toast-{toast.type}">{toast.msg}</div>
	{/each}
</div>

<div class="page">
	<!-- KPI Cards -->
	<div class="kpi-grid">
		<KpiCard
			label="Usuários"
			value={data.metrics.users.total}
			sub="+{data.metrics.users.signups_last_7d} nos últimos 7d"
		/>
		<KpiCard
			label="Entrevistas Maduras"
			value="{data.metrics.interviews.mature}/{data.metrics.interviews.total}"
			sub="maturidade média {Math.round(data.metrics.interviews.avg_maturity * 100)}%"
			color={data.metrics.interviews.mature / Math.max(data.metrics.interviews.total, 1) >= 0.5 ? 'success' : 'warning'}
		/>
		<KpiCard
			label="Taxa de Sucesso Pipeline"
			value="{pipelineSuccessRate}%"
			sub="{data.metrics.estimates.done} concluídas / {data.metrics.estimates.total} total"
			color={pipelineSuccessRate >= 80 ? 'success' : pipelineSuccessRate >= 50 ? 'warning' : 'error'}
		/>
		<KpiCard
			label="Projetos Criados"
			value={data.metrics.projects.total}
			sub="{data.metrics.projects.active} ativos"
		/>
	</div>

	<!-- Funil + Tokens -->
	<div class="row">
		<div class="col-wide">
			<ConversionFunnel
				steps={funnel}
				period={funnelPeriod}
				onperiodchange={changeFunnelPeriod}
			/>
		</div>
		<div class="col-narrow">
			<AlertsPanel alerts={data.alerts} />
		</div>
	</div>

	<!-- Tokens + Pipelines ativos -->
	<div class="row">
		<div class="col-narrow">
			<TokenCostWidget stats={data.tokenStats} />
		</div>
		<div class="col-wide">
			<ActivePipelines {pipelines} />
		</div>
	</div>
</div>

<style>
	.page {
		padding: 2rem 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 380px;
		gap: 1rem;
		align-items: start;
	}

	.col-wide { min-width: 0; }
	.col-narrow { min-width: 0; }

	@media (max-width: 1100px) {
		.kpi-grid { grid-template-columns: repeat(2, 1fr); }
		.row { grid-template-columns: 1fr; }
	}

	/* Toast */
	.toast-container {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 200;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.toast {
		padding: 0.625rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		animation: slide-in 0.2s ease;
	}

	.toast-success {
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: #6ee7b7;
	}

	.toast-error {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #fca5a5;
	}

	@keyframes slide-in {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}
</style>
