<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '@oute/ui';
	import { auth } from '$lib/firebase';
	import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

	let loading = $state(false);
	let error = $state('');

	async function loginWithGoogle() {
		loading = true;
		error = '';

		try {
			const provider = new GoogleAuthProvider();
			await signInWithPopup(auth, provider);
			await goto('/interviews');
		} catch (err) {
			error = 'Falha ao fazer login. Tente novamente.';
			console.error('Login error:', err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login — oute.me</title>
</svelte:head>

<div class="login-page">
	<div class="login-card">
		<h1 class="brand">oute.me</h1>
		<p class="tagline">Estimativa de projetos de software com IA</p>

		<Button onclick={loginWithGoogle} disabled={loading} size="lg">
			{loading ? 'Entrando…' : 'Entrar com Google'}
		</Button>

		{#if error}
			<p class="error">{error}</p>
		{/if}
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 60px);
		background-color: var(--color-dark-bg, #0f1117);
	}

	.login-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		padding: 3rem 2.5rem;
		background-color: var(--color-dark-surface, #1a1d27);
		border-radius: 12px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		width: 100%;
		max-width: 400px;
	}

	.brand {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--color-primary-500, #6366f1);
		margin: 0;
	}

	.tagline {
		color: var(--color-neutral-500, #6b7280);
		margin: 0;
		font-size: 0.95rem;
	}

	.error {
		color: var(--color-error, #ef4444);
		font-size: 0.875rem;
		margin: 0;
	}
</style>
