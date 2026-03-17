<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '@oute/ui';
	import { auth } from '$lib/firebase';
	import {
		signInWithEmailAndPassword,
		createUserWithEmailAndPassword,
		type AuthError,
		// GoogleAuthProvider,
		// signInWithPopup,
	} from 'firebase/auth';

	let mode = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	const errorMessages: Record<string, string> = {
		'auth/user-not-found': 'Nenhuma conta encontrada com este e-mail.',
		'auth/wrong-password': 'Senha incorreta.',
		'auth/invalid-credential': 'E-mail ou senha inválidos.',
		'auth/email-already-in-use': 'Este e-mail já está em uso.',
		'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
		'auth/invalid-email': 'E-mail inválido.',
		'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
		'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
	};

	async function handleSubmit() {
		if (!email || !password) {
			error = 'Preencha e-mail e senha.';
			return;
		}

		loading = true;
		error = '';

		try {
			let userCredential;
			if (mode === 'login') {
				userCredential = await signInWithEmailAndPassword(auth, email, password);
			} else {
				userCredential = await createUserWithEmailAndPassword(auth, email, password);
			}

			const idToken = await userCredential.user.getIdToken();
			await fetch('/api/auth/session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken }),
			});
			await goto('/interviews');
		} catch (err) {
			const authErr = err as AuthError;
			const code = authErr?.code || '';
			error = errorMessages[code] || `Falha ao autenticar (${code || 'unknown'}). Tente novamente.`;
			console.error('Auth error:', code, authErr?.message);
		} finally {
			loading = false;
		}
	}

	// async function loginWithGoogle() {
	// 	loading = true;
	// 	error = '';
	// 	try {
	// 		const provider = new GoogleAuthProvider();
	// 		const result = await signInWithPopup(auth, provider);
	// 		const idToken = await result.user.getIdToken();
	// 		await fetch('/api/auth/session', {
	// 			method: 'POST',
	// 			headers: { 'Content-Type': 'application/json' },
	// 			body: JSON.stringify({ idToken }),
	// 		});
	// 		await goto('/interviews');
	// 	} catch (err) {
	// 		const authErr = err as AuthError;
	// 		const code = authErr?.code || '';
	// 		error = errorMessages[code] || `Falha ao fazer login (${code || 'unknown'}). Tente novamente.`;
	// 		console.error('Login error:', code, authErr?.message);
	// 	} finally {
	// 		loading = false;
	// 	}
	// }
</script>

<svelte:head>
	<title>Login — oute.me</title>
</svelte:head>

<div class="login-page">
	<div class="login-card">
		<h1 class="brand">oute.me</h1>
		<p class="tagline">Estimativa de projetos de software com IA</p>

		<div class="tabs">
			<button class="tab" class:active={mode === 'login'} onclick={() => { mode = 'login'; error = ''; }}>
				Entrar
			</button>
			<button class="tab" class:active={mode === 'register'} onclick={() => { mode = 'register'; error = ''; }}>
				Criar conta
			</button>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="form">
			<div class="field">
				<label for="email">E-mail</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="seu@email.com"
					disabled={loading}
					autocomplete="email"
					required
				/>
			</div>

			<div class="field">
				<label for="password">Senha</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
					disabled={loading}
					autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					required
				/>
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<Button type="submit" disabled={loading} size="lg" style="width: 100%;">
				{#if loading}
					{mode === 'login' ? 'Entrando…' : 'Criando conta…'}
				{:else}
					{mode === 'login' ? 'Entrar' : 'Criar conta'}
				{/if}
			</Button>
		</form>

		<!-- <Button onclick={loginWithGoogle} disabled={loading} size="lg">
			{loading ? 'Entrando…' : 'Entrar com Google'}
		</Button> -->
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

	.tabs {
		display: flex;
		width: 100%;
		background-color: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 4px;
		gap: 4px;
	}

	.tab {
		flex: 1;
		padding: 0.5rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-neutral-500, #6b7280);
		cursor: pointer;
		font-size: 0.9rem;
		transition: background 0.15s, color 0.15s;
	}

	.tab.active {
		background-color: var(--color-dark-surface, #1a1d27);
		color: var(--color-neutral-100, #f3f4f6);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.field label {
		font-size: 0.875rem;
		color: var(--color-neutral-300, #d1d5db);
	}

	.field input {
		padding: 0.625rem 0.875rem;
		background-color: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: var(--color-neutral-100, #f3f4f6);
		font-size: 0.95rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.field input:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	.field input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.field input::placeholder {
		color: var(--color-neutral-600, #4b5563);
	}

	.error {
		color: var(--color-error, #ef4444);
		font-size: 0.875rem;
		margin: 0;
	}
</style>
