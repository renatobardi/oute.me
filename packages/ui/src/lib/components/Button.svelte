<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		style?: string;
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let { variant = 'primary', size = 'md', type = 'button', style, disabled = false, onclick, children }: Props = $props();
</script>

<button class="btn btn-{variant} btn-{size}" {type} {style} {disabled} {onclick}>
	{@render children()}
</button>

<style>
	.btn {
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: var(--color-primary-500, #6366f1);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: var(--color-primary-600, #4f46e5);
	}

	.btn-secondary {
		background-color: var(--color-dark-surface, #1a1d27);
		color: white;
		border: 1px solid var(--color-primary-500, #6366f1);
	}

	.btn-ghost {
		background-color: transparent;
		color: var(--color-primary-500, #6366f1);
	}

	.btn-sm {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
	}
	.btn-md {
		padding: 0.5rem 1rem;
		font-size: 1rem;
	}
	.btn-lg {
		padding: 0.75rem 1.5rem;
		font-size: 1.125rem;
	}
</style>
