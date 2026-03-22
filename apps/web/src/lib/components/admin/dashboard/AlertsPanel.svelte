<script lang="ts">
	import type { AdminAlert } from '$lib/server/admin-dashboard';
	import { fmtDate } from '$lib/utils/admin';

	let { alerts }: { alerts: AdminAlert[] } = $props();

	const iconMap: Record<AdminAlert['type'], string> = {
		pipeline_failed: '✗',
		stale_interview: '⏸',
		stuck_job: '⚠',
	};

	const labelMap: Record<AdminAlert['type'], string> = {
		pipeline_failed: 'Pipeline falhou',
		stale_interview: 'Entrevista parada',
		stuck_job: 'Job travado',
	};
</script>

<div class="alerts-card">
	<div class="section-title">Alertas</div>

	{#if alerts.length === 0}
		<div class="empty">Nenhum alerta no momento.</div>
	{:else}
		<div class="alerts-list">
			{#each alerts as alert (alert.interview_id + alert.type + alert.occurred_at)}
				<a class="alert-row alert-{alert.severity}" href="/admin/cockpit/{alert.interview_id}">
					<span class="alert-icon">{iconMap[alert.type]}</span>
					<div class="alert-body">
						<div class="alert-label">
							<span class="alert-type">{labelMap[alert.type]}</span>
							<span class="alert-title">{alert.interview_title ?? alert.interview_id.slice(0, 8)}</span>
						</div>
						<div class="alert-meta">
							<span>{alert.user_email}</span>
							<span>·</span>
							<span>{fmtDate(alert.occurred_at)}</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.alerts-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 1.25rem 1.5rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 1rem;
	}

	.empty {
		font-size: 0.875rem;
		color: var(--color-neutral-500, #6b7280);
		text-align: center;
		padding: 1rem 0;
	}

	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.alert-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 1px solid transparent;
		text-decoration: none;
		transition: background 0.15s;
	}

	.alert-row:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.alert-high {
		border-color: rgba(239, 68, 68, 0.2);
		background: rgba(239, 68, 68, 0.05);
	}

	.alert-medium {
		border-color: rgba(245, 158, 11, 0.2);
		background: rgba(245, 158, 11, 0.05);
	}

	.alert-icon {
		font-size: 0.875rem;
		font-weight: 700;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.alert-high .alert-icon   { color: var(--color-error, #ef4444); }
	.alert-medium .alert-icon { color: var(--color-warning, #f59e0b); }

	.alert-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.alert-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.alert-type {
		font-size: 0.75rem;
		font-weight: 600;
		color: #f9fafb;
	}

	.alert-title {
		font-size: 0.75rem;
		color: var(--color-neutral-400, #9ca3af);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.alert-meta {
		display: flex;
		gap: 0.4rem;
		font-size: 0.7rem;
		color: var(--color-neutral-500, #6b7280);
	}
</style>
