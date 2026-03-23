<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { AuditSession, AuditEvent } from '$lib/server/admin-audit';

	let { data } = $props();

	type Period = 7 | 30 | 90;

	let sessions = $state<AuditSession[]>(data.sessions);
	let total = $state(data.total);
	let eventTypes = $state<string[]>(data.eventTypes);
	let actors = $state<{ id: string; email: string }[]>(data.actors);

	let period = $state<Period>(30);
	let eventTypeFilter = $state('');
	let actorFilter = $state('');
	let resourceTypeFilter = $state('');
	let loading = $state(false);

	async function refresh() {
		loading = true;
		try {
			const token = (await auth.currentUser?.getIdToken(false)) ?? '';
			let query = `period=${period}`;
			if (eventTypeFilter) query += `&event_type=${encodeURIComponent(eventTypeFilter)}`;
			if (actorFilter) query += `&actor_id=${encodeURIComponent(actorFilter)}`;
			if (resourceTypeFilter) query += `&resource_type=${encodeURIComponent(resourceTypeFilter)}`;
			const res = await fetch(`/api/admin/audit?${query}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) {
				const d = await res.json();
				sessions = d.sessions;
				total = d.total;
			}
		} finally {
			loading = false;
		}
	}

	const EVENT_ICONS: Record<string, string> = {
		'interview.created':         '💬',
		'interview.maturity_reached': '🎯',
		'interview.document_uploaded':'📄',
		'estimate.triggered':         '⚙️',
		'estimate.completed':         '✅',
		'estimate.failed':            '❌',
		'estimate.approved':          '👍',
		'project.created':            '🚀',
		'user.activated':             '👤',
	};

	const EVENT_COLORS: Record<string, string> = {
		'interview.created':          'rgba(99, 102, 241, 0.15)',
		'interview.maturity_reached': 'rgba(16, 185, 129, 0.15)',
		'interview.document_uploaded':'rgba(245, 158, 11, 0.12)',
		'estimate.triggered':         'rgba(99, 102, 241, 0.12)',
		'estimate.completed':         'rgba(16, 185, 129, 0.12)',
		'estimate.failed':            'rgba(239, 68, 68, 0.12)',
		'estimate.approved':          'rgba(16, 185, 129, 0.18)',
		'project.created':            'rgba(139, 92, 246, 0.15)',
		'user.activated':             'rgba(59, 130, 246, 0.12)',
	};

	function fmtTime(iso: string) {
		return new Date(iso).toLocaleString('pt-BR', {
			day: '2-digit', month: '2-digit',
			hour: '2-digit', minute: '2-digit', second: '2-digit',
		});
	}

	function fmtSessionDate(iso: string) {
		return new Date(iso).toLocaleDateString('pt-BR', {
			weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
		});
	}

	function eventColor(type: string) {
		return EVENT_COLORS[type] ?? 'rgba(255,255,255,0.04)';
	}

	function eventIcon(type: string) {
		return EVENT_ICONS[type] ?? '•';
	}

	function detailsSummary(ev: AuditEvent): string {
		const d = ev.details;
		if (!d || Object.keys(d).length === 0) return '';
		const parts: string[] = [];
		for (const [k, v] of Object.entries(d)) {
			if (typeof v === 'number') parts.push(`${k}: ${typeof v === 'number' && k.includes('maturity') ? Math.round((v as number) * 100) + '%' : v}`);
			else if (typeof v === 'string') parts.push(`${k}: ${v}`);
		}
		return parts.slice(0, 3).join(' · ');
	}
</script>

<svelte:head>
	<title>Audit — oute.pro</title>
</svelte:head>

<div class="page">
	<!-- Filters -->
	<div class="filters">
		<div class="filter-group">
			<label class="filter-label">Período</label>
			<div class="btn-group">
				{#each ([7, 30, 90] as Period[]) as p (p)}
					<button
						class="btn-period"
						class:active={period === p}
						onclick={() => { period = p; refresh(); }}
						type="button"
					>{p}d</button>
				{/each}
			</div>
		</div>

		{#if eventTypes.length > 0}
			<div class="filter-group">
				<label class="filter-label" for="filter-event">Tipo de Evento</label>
				<select id="filter-event" class="select" bind:value={eventTypeFilter} onchange={refresh}>
					<option value="">Todos</option>
					{#each eventTypes as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if actors.length > 0}
			<div class="filter-group">
				<label class="filter-label" for="filter-actor">Ator</label>
				<select id="filter-actor" class="select" bind:value={actorFilter} onchange={refresh}>
					<option value="">Todos</option>
					{#each actors as a (a.id)}
						<option value={a.id}>{a.email}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="filter-group">
			<label class="filter-label" for="filter-resource">Resource Type</label>
			<select id="filter-resource" class="select" bind:value={resourceTypeFilter} onchange={refresh}>
				<option value="">Todos</option>
				<option value="interview">interview</option>
				<option value="estimate">estimate</option>
				<option value="project">project</option>
				<option value="user">user</option>
			</select>
		</div>

		<div class="filter-right">
			{#if loading}
				<span class="loading-dot"></span>
			{/if}
			<span class="total-count">{total} eventos</span>
		</div>
	</div>

	<!-- Timeline -->
	{#if sessions.length === 0}
		<div class="empty-state">Nenhum evento no período selecionado.</div>
	{:else}
		<div class="timeline">
			{#each sessions as session, si (si)}
				<div class="session">
					<div class="session-header">
						<span class="session-date">{fmtSessionDate(session.session_start)}</span>
						<span class="session-count">{session.events.length} evento(s)</span>
					</div>

					<div class="events">
						{#each session.events as ev (ev.id)}
							<div class="event-row" style="background: {eventColor(ev.event_type)};">
								<div class="event-dot">
									<span class="event-icon">{eventIcon(ev.event_type)}</span>
								</div>
								<div class="event-body">
									<div class="event-header">
										<span class="event-type">{ev.event_type}</span>
										<span class="event-time">{fmtTime(ev.created_at)}</span>
									</div>
									<div class="event-meta">
										{#if ev.actor_email}
											<span class="meta-tag">{ev.actor_email}</span>
										{/if}
										{#if ev.resource_id}
											<a
												class="meta-tag meta-link"
												href={ev.resource_type === 'interview' ? `/admin/cockpit/${ev.resource_id}` : '#'}
											>
												{ev.resource_type}/{ev.resource_id?.slice(0, 8)}
											</a>
										{/if}
										{#if detailsSummary(ev)}
											<span class="meta-details">{detailsSummary(ev)}</span>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		padding: 1.5rem;
		max-width: 900px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Filters */
	.filters {
		display: flex;
		gap: 1.25rem;
		align-items: flex-end;
		flex-wrap: wrap;
		padding: 0.875rem 1rem;
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.filter-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-neutral-500, #6b7280);
	}

	.btn-group {
		display: flex;
		gap: 0.25rem;
	}

	.btn-period {
		padding: 0.3rem 0.7rem;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
		color: #9ca3af;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-period.active {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.4);
		color: var(--color-primary-400, #818cf8);
	}

	.select {
		padding: 0.3rem 0.6rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		color: #e5e7eb;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.filter-right {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-left: auto;
	}

	.total-count {
		font-size: 0.8rem;
		color: #6b7280;
	}

	.loading-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-primary-400, #818cf8);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50%       { opacity: 1; }
	}

	/* Empty */
	.empty-state {
		text-align: center;
		font-size: 0.875rem;
		color: #6b7280;
		padding: 3rem 0;
	}

	/* Timeline */
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.session {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.session-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.session-date {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f3f4f6;
		text-transform: capitalize;
	}

	.session-count {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.events {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-left: 0.5rem;
		border-left: 2px solid rgba(255, 255, 255, 0.06);
	}

	.event-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		padding: 0.5rem 0.75rem;
		border-radius: 7px;
		border: 1px solid rgba(255, 255, 255, 0.04);
	}

	.event-dot {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.06);
		font-size: 0.75rem;
	}

	.event-icon { line-height: 1; }

	.event-body {
		flex: 1;
		min-width: 0;
	}

	.event-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.event-type {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #f3f4f6;
		font-family: monospace;
	}

	.event-time {
		font-size: 0.7rem;
		color: #6b7280;
		white-space: nowrap;
		font-family: monospace;
		flex-shrink: 0;
	}

	.event-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
	}

	.meta-tag {
		font-size: 0.7rem;
		padding: 0.1rem 0.45rem;
		background: rgba(255, 255, 255, 0.06);
		color: #9ca3af;
		border-radius: 4px;
	}

	.meta-link {
		color: var(--color-primary-400, #818cf8);
		text-decoration: none;
	}

	.meta-link:hover { text-decoration: underline; }

	.meta-details {
		font-size: 0.7rem;
		color: #6b7280;
		font-style: italic;
	}
</style>
