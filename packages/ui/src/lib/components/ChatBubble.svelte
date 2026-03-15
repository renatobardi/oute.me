<script lang="ts">
	interface Props {
		role: 'user' | 'assistant';
		content: string;
		timestamp?: string;
	}

	let { role, content, timestamp }: Props = $props();
</script>

<div class="bubble bubble-{role}">
	<div class="bubble-content">
		{content}
	</div>
	{#if timestamp}
		<time class="bubble-time">{timestamp}</time>
	{/if}
</div>

<style>
	.bubble {
		max-width: 80%;
		padding: 0.75rem 1rem;
		border-radius: 12px;
		margin-bottom: 0.5rem;
		line-height: 1.5;
		font-size: 0.9375rem;
	}

	.bubble-user {
		align-self: flex-end;
		background-color: var(--color-primary-500, #6366f1);
		color: white;
		border-bottom-right-radius: 4px;
	}

	.bubble-assistant {
		align-self: flex-start;
		background-color: var(--color-dark-surface, #1a1d27);
		color: var(--color-neutral-300, #d1d5db);
		border-bottom-left-radius: 4px;
	}

	.bubble-time {
		display: block;
		font-size: 0.75rem;
		opacity: 0.6;
		margin-top: 0.25rem;
	}
</style>
