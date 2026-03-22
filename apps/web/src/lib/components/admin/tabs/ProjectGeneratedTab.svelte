<script lang="ts">
	import type { Project } from '$lib/types/project';

	let { project }: { project: Project } = $props();
</script>

<div class="tab-content">
	<div class="section-title">Projeto</div>
	<div class="info-list">
		<div class="info-row">
			<span class="info-row-label">Nome</span>
			<span class="info-row-value">{project.name ?? '—'}</span>
		</div>
		<div class="info-row">
			<span class="info-row-label">ID</span>
			<span class="info-row-value mono">{project.id}</span>
		</div>
		<div class="info-row">
			<span class="info-row-label">Link</span>
			<a class="project-link" href="/projects/{project.id}" target="_blank">Ver Projeto →</a>
		</div>
	</div>
</div>

<style>
	.tab-content {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		padding: 1rem 1.125rem;
		margin-top: 0.5rem;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-neutral-400, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.75rem;
	}

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

	.mono {
		font-family: monospace;
		font-size: 0.8rem;
		color: #a5f3fc;
	}

	.project-link {
		font-size: 0.875rem;
		color: #6ee7b7;
		text-decoration: none;
	}

	.project-link:hover {
		text-decoration: underline;
	}
</style>
