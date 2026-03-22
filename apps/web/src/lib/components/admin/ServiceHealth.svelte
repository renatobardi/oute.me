<script lang="ts">
	import { auth } from '$lib/firebase';

	type Status = 'ok' | 'error' | 'not_configured' | 'loading';

	interface HealthData {
		postgres: string;
		redis: string;
		vertex_ai: string;
	}

	let health = $state<HealthData | null>(null);
	let loading = $state(true);

	function statusOf(raw: string | undefined): Status {
		if (!raw) return 'loading';
		if (raw === 'not_configured') return 'not_configured';
		if (raw.startsWith('ok')) return 'ok';
		return 'error';
	}

	async function fetchHealth() {
		try {
			const token = (await auth.currentUser?.getIdToken(false)) ?? '';
			const res = await fetch('/api/admin/health', {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) health = await res.json();
		} catch {
			// silent
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		fetchHealth();
		const timer = setInterval(fetchHealth, 30_000);
		return () => clearInterval(timer);
	});

	const services = $derived([
		{ key: 'postgres', label: 'PG', status: statusOf(health?.postgres) },
		{ key: 'redis', label: 'Redis', status: statusOf(health?.redis) },
		{ key: 'vertex_ai', label: 'Vertex', status: statusOf(health?.vertex_ai) },
	]);
</script>

<div class="health-widget" title="Status dos serviços (atualiza a cada 30s)">
	{#if loading}
		<span class="dot dot-loading"></span>
	{:else}
		{#each services as svc (svc.key)}
			<span class="service" title="{svc.label}: {health?.[svc.key as keyof HealthData] ?? '—'}">
				<span class="dot dot-{svc.status}"></span>
				<span class="label">{svc.label}</span>
			</span>
		{/each}
	{/if}
</div>

<style>
	.health-widget {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.875rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 8px;
	}

	.service {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot-ok            { background: var(--color-success, #10b981); }
	.dot-error         { background: var(--color-error, #ef4444); animation: pulse-err 1.5s ease-in-out infinite; }
	.dot-not_configured { background: rgba(255, 255, 255, 0.2); }
	.dot-loading       { background: rgba(255, 255, 255, 0.15); animation: pulse-loading 1s ease-in-out infinite; }

	@keyframes pulse-err {
		0%, 100% { opacity: 1; }
		50%       { opacity: 0.4; }
	}

	@keyframes pulse-loading {
		0%, 100% { opacity: 0.3; }
		50%       { opacity: 0.8; }
	}

	.label {
		font-size: 0.7rem;
		color: var(--color-neutral-500, #6b7280);
	}
</style>
