<script lang="ts">
	import type { MaturitySnapshot } from '$lib/server/maturity-snapshots';

	let { snapshots }: { snapshots: MaturitySnapshot[] } = $props();

	const DOMAIN_COLORS: Record<string, string> = {
		scope:        '#818cf8',
		timeline:     '#34d399',
		budget:       '#fbbf24',
		integrations: '#f87171',
		tech_stack:   '#a78bfa',
	};

	const DOMAIN_LABELS: Record<string, string> = {
		scope:        'Escopo',
		timeline:     'Prazo',
		budget:       'Orçamento',
		integrations: 'Integrações',
		tech_stack:   'Tech Stack',
	};

	const W = 600;
	const H = 160;
	const PAD_L = 36;
	const PAD_R = 12;
	const PAD_T = 10;
	const PAD_B = 24;
	const INNER_W = W - PAD_L - PAD_R;
	const INNER_H = H - PAD_T - PAD_B;

	// All domain keys present across all snapshots
	const domainKeys = $derived.by((): string[] => {
		const keys = new Set<string>();
		for (const snap of snapshots) {
			for (const k of Object.keys(snap.domains ?? {})) keys.add(k);
		}
		return [...keys];
	});

	function xAt(i: number, total: number): number {
		if (total <= 1) return PAD_L;
		return PAD_L + (i / (total - 1)) * INNER_W;
	}

	function yAt(value: number): number {
		return PAD_T + INNER_H - value * INNER_H;
	}

	function maturityPath(): string {
		if (snapshots.length < 2) return '';
		return snapshots
			.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i, snapshots.length).toFixed(1)},${yAt(s.maturity).toFixed(1)}`)
			.join(' ');
	}

	function domainPath(key: string): string {
		if (snapshots.length < 2) return '';
		const pts = snapshots.map((s, i) => {
			const dom = s.domains?.[key];
			const val = dom && dom.total > 0 ? dom.answered / dom.total : 0;
			return `${i === 0 ? 'M' : 'L'} ${xAt(i, snapshots.length).toFixed(1)},${yAt(val).toFixed(1)}`;
		});
		return pts.join(' ');
	}

	// Markers: vital domain first reached
	interface Marker { x: number; y: number; label: string; color: string }
	const markers = $derived.by((): Marker[] => {
		const result: Marker[] = [];
		const vitalReached = new Set<string>();
		snapshots.forEach((snap, i) => {
			for (const [key, dom] of Object.entries(snap.domains ?? {})) {
				if (dom.vital_answered && !vitalReached.has(key)) {
					vitalReached.add(key);
					result.push({
						x: xAt(i, snapshots.length),
						y: yAt(snap.maturity),
						label: DOMAIN_LABELS[key] ?? key,
						color: DOMAIN_COLORS[key] ?? '#818cf8',
					});
				}
			}
		});
		return result;
	});

	// Last maturity value
	const lastMaturity = $derived(
		snapshots.length > 0 ? Math.round((snapshots[snapshots.length - 1].maturity) * 100) : 0
	);

	// Y-axis ticks
	const yTicks = [0, 0.25, 0.5, 0.70, 1.0];
</script>

{#if snapshots.length === 0}
	<p class="empty">Nenhum dado de timeline disponível ainda.</p>
{:else}
	<div class="timeline-wrap">
		<div class="chart-header">
			<span class="chart-title">Evolução de Maturidade</span>
			<span class="current-badge">{lastMaturity}%</span>
		</div>

		<svg viewBox="0 0 {W} {H}" class="chart-svg" role="img" aria-label="Gráfico de evolução de maturidade">
			<!-- Grid lines -->
			{#each yTicks as tick (tick)}
				{@const ty = yAt(tick)}
				<line
					x1={PAD_L} y1={ty} x2={W - PAD_R} y2={ty}
					stroke={tick === 0.70 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}
					stroke-width={tick === 0.70 ? 1.5 : 1}
					stroke-dasharray={tick === 0.70 ? '4 4' : 'none'}
				/>
				<text x={PAD_L - 4} y={ty + 4} text-anchor="end" class="tick-label">
					{Math.round(tick * 100)}%
				</text>
			{/each}

			<!-- Domain secondary lines -->
			{#each domainKeys as key (key)}
				<path
					d={domainPath(key)}
					fill="none"
					stroke={DOMAIN_COLORS[key] ?? '#6b7280'}
					stroke-width="1"
					stroke-dasharray="3 3"
					opacity="0.45"
				/>
			{/each}

			<!-- Main maturity line -->
			<path d={maturityPath()} fill="none" stroke="white" stroke-width="2" stroke-linecap="round" />

			<!-- Data points on main line -->
			{#each snapshots as snap, i (i)}
				<circle
					cx={xAt(i, snapshots.length)}
					cy={yAt(snap.maturity)}
					r="3"
					fill="white"
					opacity="0.8"
				/>
			{/each}

			<!-- Vital domain markers -->
			{#each markers as m, mi (mi)}
				<circle cx={m.x} cy={m.y} r="6" fill={m.color} opacity="0.25" />
				<circle cx={m.x} cy={m.y} r="3" fill={m.color} />
			{/each}

			<!-- X-axis turn labels -->
			{#each snapshots as _snap, i (i)}
				{#if snapshots.length <= 10 || i % Math.ceil(snapshots.length / 10) === 0}
					<text x={xAt(i, snapshots.length)} y={H - 4} text-anchor="middle" class="tick-label">
						{i + 1}
					</text>
				{/if}
			{/each}
		</svg>

		<!-- Domain legend -->
		<div class="legend">
			<div class="legend-item">
				<span class="leg-line" style="background: white;"></span>
				<span>Maturidade total</span>
			</div>
			{#each domainKeys as key (key)}
				<div class="legend-item">
					<span class="leg-line leg-dashed" style="background: {DOMAIN_COLORS[key] ?? '#6b7280'};"></span>
					<span>{DOMAIN_LABELS[key] ?? key}</span>
				</div>
			{/each}
		</div>

		<!-- Threshold annotation -->
		<div class="threshold-note">
			<span class="threshold-line"></span>
			<span>70% — threshold de maturidade</span>
		</div>
	</div>
{/if}

<style>
	.empty {
		font-size: 0.8125rem;
		color: var(--color-neutral-500, #6b7280);
		text-align: center;
		padding: 1rem 0;
		margin: 0;
	}

	.timeline-wrap {
		width: 100%;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.chart-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-neutral-500, #6b7280);
	}

	.current-badge {
		font-size: 0.875rem;
		font-weight: 700;
		color: #f9fafb;
	}

	.chart-svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}

	:global(.tick-label) {
		font-size: 9px;
		fill: #4b5563;
		font-family: monospace;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.625rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.7rem;
		color: #9ca3af;
	}

	.leg-line {
		display: inline-block;
		width: 20px;
		height: 2px;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.leg-dashed {
		background-image: repeating-linear-gradient(
			90deg,
			currentColor 0,
			currentColor 4px,
			transparent 4px,
			transparent 7px
		);
		background-color: transparent !important;
	}

	.threshold-note {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.375rem;
		font-size: 0.7rem;
		color: rgba(99, 102, 241, 0.7);
	}

	.threshold-line {
		display: inline-block;
		width: 16px;
		height: 1px;
		background: rgba(99, 102, 241, 0.5);
		border-top: 1px dashed rgba(99, 102, 241, 0.5);
	}
</style>
