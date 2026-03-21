/**
 * Svelte action: adiciona/remove classes de inset shadow quando o container
 * tem conteúdo acima ou abaixo do viewport visível.
 *
 * Usage: <div class="my-scroll" use:scrollShadow>...</div>
 *
 * Classes adicionadas automaticamente:
 *   .scroll-shadow-top    — há conteúdo acima
 *   .scroll-shadow-bottom — há conteúdo abaixo
 */
export function scrollShadow(node: HTMLElement) {
	function update() {
		const atTop = node.scrollTop <= 2;
		const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 2;
		node.classList.toggle('scroll-shadow-top', !atTop);
		node.classList.toggle('scroll-shadow-bottom', !atBottom);
	}

	node.addEventListener('scroll', update, { passive: true });

	const ro = new ResizeObserver(update);
	ro.observe(node);

	// Check inicial — aguarda um tick para o DOM estar renderizado
	requestAnimationFrame(update);

	return {
		destroy() {
			node.removeEventListener('scroll', update);
			ro.disconnect();
		},
	};
}
