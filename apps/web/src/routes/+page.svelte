<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '@oute/ui';

	const user = $derived($page.data.user);

	$effect(() => {
		if (user) {
			goto('/interviews');
		}
	});

	function scrollToFeatures() {
		document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>oute.me — Estime projetos de software com IA</title>
	<meta name="description" content="Do briefing ao cronograma em minutos. Estimativa inteligente de projetos de software com IA." />
</svelte:head>

<!-- Hero -->
<section class="hero">
	<div class="container">
		<h1 class="hero-title">Estime projetos de software com IA</h1>
		<p class="hero-subtitle">Do briefing ao cronograma em minutos</p>
		<div class="hero-actions">
			<Button onclick={() => goto('/login')} size="lg">Começar agora</Button>
			<Button onclick={scrollToFeatures} variant="secondary" size="lg">Ver como funciona</Button>
		</div>
	</div>
</section>

<!-- Como funciona -->
<section id="como-funciona" class="section">
	<div class="container">
		<h2 class="section-title">Como funciona</h2>
		<div class="steps">
			<div class="step-card">
				<div class="step-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					</svg>
				</div>
				<h3>Interview</h3>
				<p>Converse com a IA sobre seu projeto. Ela entende escopo, prazo, orçamento e requisitos técnicos.</p>
			</div>
			<div class="step-card">
				<div class="step-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
					</svg>
				</div>
				<h3>Estimate</h3>
				<p>Agentes especializados analisam seus requisitos e geram estimativas com três cenários de custo.</p>
			</div>
			<div class="step-card">
				<div class="step-icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
					</svg>
				</div>
				<h3>Project</h3>
				<p>Aprove a estimativa e receba um plano de projeto com milestones e cronograma detalhado.</p>
			</div>
		</div>
	</div>
</section>

<!-- Features -->
<section class="section section-alt">
	<div class="container">
		<h2 class="section-title">Recursos</h2>
		<div class="features">
			<div class="feature">
				<h3>Entrevista inteligente</h3>
				<p>A IA conduz a conversa de forma estruturada, cobrindo todos os domínios críticos do projeto: escopo, prazo, orçamento, integrações e stack técnica.</p>
			</div>
			<div class="feature">
				<h3>Estimativa com IA</h3>
				<p>Seis agentes especializados trabalham em sequência — do arquiteto ao revisor — para gerar estimativas precisas baseadas em projetos similares.</p>
			</div>
			<div class="feature">
				<h3>Gestão de projeto</h3>
				<p>Transforme estimativas aprovadas em projetos com milestones, tarefas e acompanhamento de progresso integrado.</p>
			</div>
		</div>
	</div>
</section>

<!-- CTA -->
<section class="cta">
	<div class="container">
		<h2 class="cta-title">Pronto para estimar seu próximo projeto?</h2>
		<Button onclick={() => goto('/login')} size="lg">Começar gratuitamente</Button>
	</div>
</section>

<!-- Footer -->
<footer class="footer">
	<div class="container">
		<p>oute.me &copy; 2026</p>
	</div>
</footer>

<style>
	.container {
		max-width: 1120px;
		margin: 0 auto;
		padding: 0 1.5rem;
	}

	/* Hero */
	.hero {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 60px);
		text-align: center;
	}

	.hero-title {
		font-size: 3.5rem;
		font-weight: 800;
		color: #f9fafb;
		margin: 0 0 1rem;
		line-height: 1.1;
	}

	.hero-subtitle {
		font-size: 1.25rem;
		color: var(--color-neutral-500, #6b7280);
		margin: 0 0 2.5rem;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	/* Sections */
	.section {
		padding: 5rem 0;
	}

	.section-alt {
		background-color: var(--color-dark-surface, #1a1d27);
	}

	.section-title {
		text-align: center;
		font-size: 2rem;
		font-weight: 700;
		color: #f9fafb;
		margin: 0 0 3rem;
	}

	/* Steps */
	.steps {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2rem;
	}

	.step-card {
		background-color: var(--color-dark-surface, #1a1d27);
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
	}

	.step-icon {
		color: var(--color-primary-500, #6366f1);
		margin-bottom: 1rem;
	}

	.step-card h3 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #f9fafb;
		margin: 0 0 0.75rem;
	}

	.step-card p {
		color: var(--color-neutral-500, #6b7280);
		line-height: 1.6;
		margin: 0;
	}

	/* Features */
	.features {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2.5rem;
	}

	.feature h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-primary-500, #6366f1);
		margin: 0 0 0.75rem;
	}

	.feature p {
		color: var(--color-neutral-300, #d1d5db);
		line-height: 1.7;
		margin: 0;
	}

	/* CTA */
	.cta {
		padding: 5rem 0;
		text-align: center;
		background: linear-gradient(135deg, var(--color-primary-600, #4f46e5) 0%, #3730a3 100%);
	}

	.cta-title {
		font-size: 2rem;
		font-weight: 700;
		color: #ffffff;
		margin: 0 0 2rem;
	}

	/* Footer */
	.footer {
		padding: 2rem 0;
		text-align: center;
		border-top: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
	}

	.footer p {
		color: var(--color-neutral-500, #6b7280);
		margin: 0;
		font-size: 0.875rem;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.hero-title {
			font-size: 2.25rem;
		}

		.hero-subtitle {
			font-size: 1.1rem;
		}

		.steps {
			grid-template-columns: 1fr;
		}

		.features {
			grid-template-columns: 1fr;
		}

		.section-title {
			font-size: 1.5rem;
		}

		.cta-title {
			font-size: 1.5rem;
		}
	}
</style>
