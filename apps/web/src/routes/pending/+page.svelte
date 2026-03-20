<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '@oute/ui';
	import { auth } from '$lib/firebase';
	import { sendEmailVerification } from 'firebase/auth';

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let { data } = $props();

	let emailVerified = $state(data.emailVerified);
	let resending = $state(false);
	let resent = $state(false);
	onMount(async () => {
		if (emailVerified) return;

		// Verifica se o usuário acabou de clicar no link de verificação
		try {
			await auth.currentUser?.reload();
			const verified = auth.currentUser?.emailVerified ?? false;

			if (verified) {
				// Atualiza o cookie com token fresco para o hook detectar email_verified=true
				const newToken = await auth.currentUser?.getIdToken(true);
				if (newToken) {
					await fetch('/api/auth/session', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ idToken: newToken }),
					});
				}
				// Recarrega a página — o servidor vai detectar email_verified e atualizar o estado
				window.location.reload();
			}
		} finally {
		}
	});

	async function resend() {
		if (!auth.currentUser) return;
		resending = true;
		try {
			await sendEmailVerification(auth.currentUser);
			resent = true;
		} catch {
			// Ignora erro silenciosamente (ex: too-many-requests)
		} finally {
			resending = false;
		}
	}
</script>

<svelte:head>
	<title>Aguardando ativação — oute.me</title>
</svelte:head>

<div class="page">
	<div class="card">
		<h1 class="brand">oute.me</h1>

		{#if !emailVerified}
			<div class="icon">📧</div>
			<h2 class="title">Confirme seu e-mail</h2>
			<p class="body">
				Enviamos um link de confirmação para <strong>{data.email}</strong>.
				Clique no link para ativar sua conta.
			</p>
			<p class="hint">Não encontrou? Verifique a caixa de spam.</p>

			{#if resent}
				<p class="success">E-mail reenviado com sucesso.</p>
			{:else}
				<Button onclick={resend} disabled={resending} size="md">
					{resending ? 'Enviando…' : 'Reenviar e-mail'}
				</Button>
			{/if}
		{:else}
			<div class="icon">⏳</div>
			<h2 class="title">Aguardando ativação</h2>
			<p class="body">
				Seu e-mail foi confirmado. Sua conta está em análise pela equipe do oute.me.
				Você receberá um e-mail quando for ativado.
			</p>
		{/if}
	</div>
</div>

<style>
	.page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 60px);
		background-color: var(--color-dark-bg, #0f1117);
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		padding: 3rem 2.5rem;
		background-color: var(--color-dark-surface, #1a1d27);
		border-radius: 12px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		width: 100%;
		max-width: 420px;
		text-align: center;
	}

	.brand {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary-500, #6366f1);
		margin: 0;
	}

	.icon {
		font-size: 2.5rem;
		line-height: 1;
	}

	.title {
		font-size: 1.25rem;
		font-weight: 600;
		color: #f9fafb;
		margin: 0;
	}

	.body {
		color: var(--color-neutral-400, #9ca3af);
		font-size: 0.9375rem;
		line-height: 1.6;
		margin: 0;
	}

	.body strong {
		color: var(--color-neutral-200, #e5e7eb);
	}

	.hint {
		color: var(--color-neutral-600, #4b5563);
		font-size: 0.8125rem;
		margin: 0;
	}

	.success {
		color: var(--color-success, #10b981);
		font-size: 0.875rem;
		margin: 0;
	}
</style>
