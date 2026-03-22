<script lang="ts">
	import { statusBadgeClass } from '$lib/utils/admin';

	let { status }: { status: string } = $props();
</script>

<span class="badge {statusBadgeClass(status)}">{status}</span>

<style>
	.badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.badge-success {
		background: color-mix(in srgb, var(--color-success, #10b981) 15%, transparent);
		color: var(--color-success, #10b981);
	}

	.badge-info {
		background: color-mix(in srgb, #60a5fa 15%, transparent);
		color: #60a5fa;
	}

	.badge-error {
		background: color-mix(in srgb, var(--color-error, #ef4444) 15%, transparent);
		color: var(--color-error, #ef4444);
	}

	.badge-neutral {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-neutral-500, #6b7280);
	}

	.badge-warning {
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent);
		color: var(--color-warning, #f59e0b);
	}
</style>
