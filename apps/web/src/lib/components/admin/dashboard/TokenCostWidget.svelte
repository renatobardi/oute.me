<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { TokenStats } from '$lib/server/admin-dashboard';

	let { stats: initialStats }: { stats: TokenStats } = $props();

	let stats = $state<TokenStats>(initialStats);
	let period = $state<7 | 30 | 90>(30);
	let loading = $state(false);

	async function refresh(p: 7 | 30 | 90) {
		period = p;
		loading = true;
		try {
			const token = (await auth.currentUser?.getIdToken(false)) ?? '';
			const res = await fetch(`/api/admin/dashboard/tokens?period=${p}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) stats = await res.json();
		} finally {
			loading = false;
		}
	}

	function fmtTokens(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
		return String(n);
	}

	// SVG sparkline for daily trend
	const W = 260;
	const H = 50;
	const PAD = 4;

	const sparkPath = $derived(() => {
		const trend = stats.daily_trend;
		if (trend.length < 2) return '';
		const maxVal = Math.max(...trend.map((d) => d.tokens), 1);
		const xs = trend.map((_, i) => PAD + (i / (trend.length - 1)) * (W - PAD * 2));
		const ys = trend.map((d) => H - PAD - ((d.tokens / maxVal) * (H - PAD * 2)));
		return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
	});

	const maxTrend = $derived(Math.max(...stats.daily_trend.map((d) => d.tokens), 1));
</script>

<div class="widget">
	<div class="widget-header">
		<span class="widget-title">Tokens de Chat</span>
		<div class="period-group">
			{#each ([7, 30, 90] as const) as p (p)}
				<button
					class="period-btn"
					class:active={period === p}
					onclick={() => refresh(p)}
					type="button"
					disabled={loading}
				>{p}d</button>
			{/each}
		</div>
	</div>

	<div class="summary-row">
		<div class="metric">
			<div class="metric-value">{fmtTokens(stats.total_tokens)}</div>
			<div class="metric-label">tokens totais</div>
		</div>
		<div class="metric">
			<div class="metric-value">{fmtTokens(stats.avg_tokens_per_interview)}</div>
			<div class="metric-label">média / entrevista</div>
		</div>
	</div>

	<!-- Sparkline -->
	{#if stats.daily_trend.length >= 2}
		<div class="sparkline-wrap">
			<svg viewBox="0 0 {W} {H}" width={W} height={H} class="sparkline">
				<!-- Area fill -->
				{#if sparkPath()}
					<defs>
						<linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stop-color="#818cf8" stop-opacity="0.25" />
							<stop offset="100%" stop-color="#818cf8" stop-opacity="0" />
						</linearGradient>
					</defs>
					{@const areaPath = sparkPath() + ` L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`}
					<path d={areaPath} fill="url(#spark-fill)" />
					<path d={sparkPath()} fill="none" stroke="#818cf8" stroke-width="1.5" stroke-linejoin="round" />
				{/if}
			</svg>
			<div class="sparkline-labels">
				<span class="spark-label">{stats.daily_trend[0]?.day?.slice(5)}</span>
				<span class="spark-label">{stats.daily_trend.at(-1)?.day?.slice(5)}</span>
			</div>
		</div>
	{/if}

	<!-- Top consumers -->
	{#if stats.top_interviews.length > 0}
		<div class="top-section">
			<div class="top-title">Top entrevistas</div>
			{#each stats.top_interviews as iv (iv.interview_id)}
				<div class="top-row">
					<div class="top-info">
						<a class="top-link" href="/admin/cockpit/{iv.interview_id}">
							{iv.title ?? iv.interview_id.slice(0, 8)}
						</a>
						<span class="top-email">{iv.user_email}</span>
					</div>
					<div class="top-bar-wrap">
						<div
							class="top-bar"
							style="width: {Math.round((iv.tokens / maxTrend) * 100)}%"
						></div>
						<span class="top-tokens">{fmtTokens(iv.tokens)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.widget {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.widget-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.widget-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f3f4f6;
	}

	.period-group {
		display: flex;
		gap: 0.2rem;
	}

	.period-btn {
		padding: 0.2rem 0.55rem;
		border-radius: 5px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
		color: #9ca3af;
		font-size: 0.72rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.period-btn.active {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.4);
		color: #818cf8;
	}

	.period-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.summary-row {
		display: flex;
		gap: 1.5rem;
	}

	.metric-value {
		font-size: 1.375rem;
		font-weight: 700;
		color: #f9fafb;
		line-height: 1;
	}

	.metric-label {
		font-size: 0.7rem;
		color: #6b7280;
		margin-top: 0.2rem;
	}

	.sparkline-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.sparkline {
		display: block;
	}

	.sparkline-labels {
		display: flex;
		justify-content: space-between;
	}

	.spark-label {
		font-size: 0.65rem;
		color: #6b7280;
	}

	.top-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.top-title {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		margin-bottom: 0.15rem;
	}

	.top-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.top-info {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.top-link {
		font-size: 0.75rem;
		color: #818cf8;
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 140px;
	}

	.top-link:hover { text-decoration: underline; }

	.top-email {
		font-size: 0.68rem;
		color: #6b7280;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
	}

	.top-bar-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.top-bar {
		height: 4px;
		background: rgba(99, 102, 241, 0.5);
		border-radius: 2px;
		min-width: 2px;
		flex-grow: 0;
		transition: width 0.3s;
	}

	.top-tokens {
		font-size: 0.68rem;
		color: #9ca3af;
		white-space: nowrap;
	}
</style>
