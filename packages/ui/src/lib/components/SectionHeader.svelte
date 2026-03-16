<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children?: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<header class="section-header">
	<h2>{title}</h2>
	{#if children}
		<div class="actions">
			{@render children()}
		</div>
	{/if}
</header>

<style>
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-neutral-300, #d1d5db);
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
</style>
