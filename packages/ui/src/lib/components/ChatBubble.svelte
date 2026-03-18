<script lang="ts">
	interface Props {
		role: 'user' | 'assistant';
		content: string;
		timestamp?: string;
	}

	let { role, content, timestamp }: Props = $props();

	function parseMarkdown(text: string): string {
		let html = text
			// Escape HTML
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		// Code blocks (```)
		html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

		// Inline code
		html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

		// Headings
		html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
		html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
		html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
		html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

		// Bold + italic
		html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
		// Bold
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		// Italic
		html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

		// Unordered lists
		html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
		html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

		// Ordered lists
		html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

		// Blockquotes
		html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

		// Line breaks (double newline = paragraph break, single = <br>)
		html = html.replace(/\n\n/g, '</p><p>');
		html = html.replace(/\n/g, '<br>');

		// Wrap in paragraph if not already wrapped in block elements
		if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<pre')) {
			html = '<p>' + html + '</p>';
		}

		// Clean up empty paragraphs
		html = html.replace(/<p><\/p>/g, '');

		return html;
	}

	let renderedHtml = $derived(role === 'assistant' ? parseMarkdown(content) : '');
</script>

<div class="bubble bubble-{role}">
	<div class="bubble-content">
		{#if role === 'assistant'}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html renderedHtml}
		{:else}
			{content}
		{/if}
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

	/* Markdown styles for assistant bubbles */
	.bubble-assistant .bubble-content :global(h1),
	.bubble-assistant .bubble-content :global(h2),
	.bubble-assistant .bubble-content :global(h3),
	.bubble-assistant .bubble-content :global(h4) {
		color: #f9fafb;
		margin: 0.75rem 0 0.375rem;
		line-height: 1.3;
	}

	.bubble-assistant .bubble-content :global(h1) { font-size: 1.125rem; }
	.bubble-assistant .bubble-content :global(h2) { font-size: 1.0625rem; }
	.bubble-assistant .bubble-content :global(h3) { font-size: 1rem; }
	.bubble-assistant .bubble-content :global(h4) { font-size: 0.9375rem; }

	.bubble-assistant .bubble-content :global(h1:first-child),
	.bubble-assistant .bubble-content :global(h2:first-child),
	.bubble-assistant .bubble-content :global(h3:first-child),
	.bubble-assistant .bubble-content :global(h4:first-child) {
		margin-top: 0;
	}

	.bubble-assistant .bubble-content :global(p) {
		margin: 0.375rem 0;
	}

	.bubble-assistant .bubble-content :global(p:first-child) {
		margin-top: 0;
	}

	.bubble-assistant .bubble-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.bubble-assistant .bubble-content :global(strong) {
		color: #f9fafb;
		font-weight: 600;
	}

	.bubble-assistant .bubble-content :global(em) {
		font-style: italic;
	}

	.bubble-assistant .bubble-content :global(ul) {
		margin: 0.375rem 0;
		padding-left: 1.25rem;
		list-style: disc;
	}

	.bubble-assistant .bubble-content :global(ol) {
		margin: 0.375rem 0;
		padding-left: 1.25rem;
	}

	.bubble-assistant .bubble-content :global(li) {
		margin: 0.125rem 0;
	}

	.bubble-assistant .bubble-content :global(code) {
		background: rgba(255, 255, 255, 0.08);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.8125rem;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.bubble-assistant .bubble-content :global(pre) {
		background: rgba(0, 0, 0, 0.3);
		padding: 0.75rem;
		border-radius: 8px;
		overflow-x: auto;
		margin: 0.5rem 0;
	}

	.bubble-assistant .bubble-content :global(pre code) {
		background: none;
		padding: 0;
		font-size: 0.8125rem;
	}

	.bubble-assistant .bubble-content :global(blockquote) {
		border-left: 3px solid var(--color-primary-500, #6366f1);
		padding-left: 0.75rem;
		margin: 0.5rem 0;
		color: var(--color-neutral-400, #9ca3af);
		font-style: italic;
	}

	.bubble-time {
		display: block;
		font-size: 0.75rem;
		opacity: 0.6;
		margin-top: 0.25rem;
	}
</style>
