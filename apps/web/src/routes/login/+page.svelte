<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '@oute/ui';
	import { auth } from '$lib/firebase';
	import {
		signInWithEmailAndPassword,
		createUserWithEmailAndPassword,
		sendEmailVerification,
		sendPasswordResetEmail,
		GoogleAuthProvider,
		signInWithPopup,
		signInWithCredential,
		type AuthError,
	} from 'firebase/auth';
	import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';
	import type {} from '$lib/types/google-one-tap';

	let mode = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let authPhase = $state<'idle' | 'firebase' | 'session' | 'done'>('idle');
	let error = $state('');
	let resetEmail = $state('');
	let resetSent = $state(false);
	let resetLoading = $state(false);
	let showReset = $state(false);

	const errorMessages: Record<string, string> = {
		'auth/user-not-found': 'Nenhuma conta encontrada com este e-mail.',
		'auth/wrong-password': 'Senha incorreta.',
		'auth/invalid-credential': 'E-mail ou senha inválidos.',
		'auth/email-already-in-use': 'Este e-mail já está em uso.',
		'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
		'auth/invalid-email': 'E-mail inválido.',
		'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
		'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
		'auth/popup-closed-by-user': 'Popup fechado antes de concluir o login.',
		'auth/popup-blocked': 'Popup bloqueado pelo navegador. Permita popups para este site.',
		'auth/cancelled-popup-request': 'Login cancelado.',
	};

	async function postSession(idToken: string) {
		const res = await fetch('/api/auth/session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken }),
		});
		return res.ok ? await res.json() : null;
	}

	function redirectAfterLogin(data: { onboarding_complete: boolean; active: boolean } | null) {
		if (!data || !data.onboarding_complete) return goto('/onboarding');
		if (!data.active) return goto('/pending');
		return goto('/interviews');
	}

	// ── One Tap credential callback ──────────────────────────────────────────
	// eslint-disable-next-line no-undef
	async function handleOneTapCredential(response: CredentialResponse) {
		loading = true;
		authPhase = 'firebase';
		error = '';

		try {
			const googleCredential = GoogleAuthProvider.credential(response.credential);

			authPhase = 'firebase';
			const result = await signInWithCredential(auth, googleCredential);

			authPhase = 'session';
			const idToken = await result.user.getIdToken();
			const data = await postSession(idToken);

			authPhase = 'done';
			await redirectAfterLogin(data);
		} catch (err) {
			const authErr = err as AuthError;
			const code = authErr?.code || '';
			error = errorMessages[code] || `Falha ao autenticar com Google (${code || 'unknown'}).`;
			loading = false;
			authPhase = 'idle';
			console.error('One Tap error:', code, authErr?.message);
		}
	}

	// ── One Tap init ─────────────────────────────────────────────────────────
	function initOneTap() {
		if (!window.google?.accounts?.id || !PUBLIC_GOOGLE_CLIENT_ID) return;

		window.google.accounts.id.initialize({
			client_id: PUBLIC_GOOGLE_CLIENT_ID,
			callback: handleOneTapCredential,
			auto_select: false,
			cancel_on_tap_outside: true,
			use_fedcm_for_prompt: false,
			itp_support: true,
			context: 'signin',
		});

		window.google.accounts.id.prompt((notification) => {
			// One Tap não disponível neste browser/sessão — o botão fallback permanece visível
			if (notification.isNotDisplayed()) {
				console.warn('[One Tap] not displayed:', notification.getNotDisplayedReason());
				return;
			}
			if (notification.isSkippedMoment()) {
				console.warn('[One Tap] skipped:', notification.getSkippedReason());
				return;
			}
		});
	}

	onMount(() => {
		if (window.google?.accounts?.id) {
			initOneTap();
		} else {
			const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
			script?.addEventListener('load', initOneTap, { once: true });
		}
	});

	// ── Botão fallback: tenta re-prompt One Tap antes de abrir popup ─────────
	async function loginWithGoogle() {
		if (window.google?.accounts?.id) {
			window.google.accounts.id.prompt((notification) => {
				if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
					doPopupLogin();
				}
				// Se One Tap aparecer, handleOneTapCredential cuida do resto
			});
			return;
		}
		await doPopupLogin();
	}

	async function doPopupLogin() {
		loading = true;
		authPhase = 'firebase';
		error = '';
		try {
			const provider = new GoogleAuthProvider();
			const result = await signInWithPopup(auth, provider);

			authPhase = 'session';
			const idToken = await result.user.getIdToken();
			const data = await postSession(idToken);

			authPhase = 'done';
			await redirectAfterLogin(data);
		} catch (err) {
			const authErr = err as AuthError;
			const code = authErr?.code || '';
			error = errorMessages[code] || `Falha ao fazer login (${code || 'unknown'}). Tente novamente.`;
			loading = false;
			authPhase = 'idle';
			console.error('Google popup error:', code, authErr?.message);
		}
	}

	// ── Recuperação de senha ────────────────────────────────────────────────
	async function handlePasswordReset() {
		if (!resetEmail) {
			error = 'Informe o e-mail para redefinir a senha.';
			return;
		}
		resetLoading = true;
		error = '';
		try {
			await sendPasswordResetEmail(auth, resetEmail);
			resetSent = true;
		} catch (err) {
			const authErr = err as AuthError;
			const code = authErr?.code || '';
			error = errorMessages[code] || 'Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.';
		} finally {
			resetLoading = false;
		}
	}

	// ── Email / senha ────────────────────────────────────────────────────────
	async function handleSubmit() {
		if (!email || !password) {
			error = 'Preencha e-mail e senha.';
			return;
		}

		loading = true;
		authPhase = 'firebase';
		error = '';

		try {
			let userCredential;
			if (mode === 'register') {
				userCredential = await createUserWithEmailAndPassword(auth, email, password);
				await sendEmailVerification(userCredential.user);
			} else {
				userCredential = await signInWithEmailAndPassword(auth, email, password);
			}

			authPhase = 'session';
			const idToken = await userCredential.user.getIdToken();
			const data = await postSession(idToken);

			authPhase = 'done';
			await redirectAfterLogin(data);
		} catch (err) {
			const authErr = err as AuthError;
			const code = authErr?.code || '';
			error = errorMessages[code] || `Falha ao autenticar (${code || 'unknown'}). Tente novamente.`;
			loading = false;
			authPhase = 'idle';
			console.error('Auth error:', code, authErr?.message);
		}
	}
</script>

<svelte:head>
	<title>Login — oute.pro</title>
	<script src="https://accounts.google.com/gsi/client" async></script>
</svelte:head>

<!-- Shimmer — aparece enquanto a autenticação processa (One Tap, popup ou email) -->
{#if loading && authPhase !== 'idle'}
	<div class="auth-transition">
		<div class="shimmer-topbar">
			<div class="shimmer-block logo-block"></div>
			<div class="shimmer-block avatar-block"></div>
		</div>
		<div class="shimmer-content">
			<div class="shimmer-header-row">
				<div class="shimmer-block title-block"></div>
				<div class="shimmer-block btn-block"></div>
			</div>
			<div class="shimmer-grid">
				{#each [1, 2, 3, 4] as _, i (i)}
					<div class="shimmer-card">
						<div class="shimmer-block line-lg"></div>
						<div class="shimmer-block line-sm" style="width: 55%"></div>
						<div class="shimmer-block bar-block"></div>
						<div class="shimmer-block line-xs" style="width: 40%"></div>
					</div>
				{/each}
			</div>
		</div>
		<p class="auth-status">
			{#if authPhase === 'firebase'}Autenticando…
			{:else if authPhase === 'session'}Iniciando sessão…
			{:else}Entrando…
			{/if}
		</p>
	</div>
{:else}
	<div class="login-page">
		<div class="login-card">
			<h1 class="brand">oute.pro</h1>
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

				{#if mode === 'login'}
					<button
						type="button"
						class="forgot-link"
						onclick={() => { showReset = !showReset; error = ''; resetSent = false; resetEmail = email; }}
					>
						Esqueceu a senha?
					</button>
				{/if}
			</form>

			{#if showReset && mode === 'login'}
				<div class="reset-box">
					{#if resetSent}
						<p class="success">E-mail de redefinição enviado. Verifique sua caixa de entrada.</p>
						<button type="button" class="forgot-link" onclick={() => { showReset = false; resetSent = false; }}>
							Voltar ao login
						</button>
					{:else}
						<p class="reset-label">Informe seu e-mail para receber o link de redefinição:</p>
						<div class="reset-row">
							<input
								type="email"
								bind:value={resetEmail}
								placeholder="seu@email.com"
								disabled={resetLoading}
								class="reset-input"
								autocomplete="email"
							/>
							<Button onclick={handlePasswordReset} disabled={resetLoading} size="sm">
								{resetLoading ? 'Enviando…' : 'Enviar'}
							</Button>
						</div>
					{/if}
				</div>
			{/if}

			<div class="divider"><span>ou</span></div>

			<Button onclick={loginWithGoogle} disabled={loading} size="lg" style="width: 100%;">
				Entrar com Google
			</Button>
		</div>
	</div>
{/if}

<style>
	/* ── Login card ─────────────────────────────────────────────────────────── */
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

	.divider {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 0.75rem;
		color: var(--color-neutral-600, #4b5563);
		font-size: 0.8125rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
	}

	.error {
		color: var(--color-error, #ef4444);
		font-size: 0.875rem;
		margin: 0;
	}

	.forgot-link {
		background: none;
		border: none;
		color: var(--color-primary-500, #6366f1);
		font-size: 0.875rem;
		cursor: pointer;
		padding: 0;
		text-align: right;
		align-self: flex-end;
	}

	.forgot-link:hover {
		text-decoration: underline;
	}

	.reset-box {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		padding: 1rem;
		background: rgba(99, 102, 241, 0.06);
		border: 1px solid rgba(99, 102, 241, 0.2);
		border-radius: 8px;
	}

	.reset-label {
		font-size: 0.875rem;
		color: var(--color-neutral-300, #d1d5db);
		margin: 0;
	}

	.reset-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.reset-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		background-color: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: var(--color-neutral-100, #f3f4f6);
		font-size: 0.9rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.reset-input:focus {
		border-color: var(--color-primary-500, #6366f1);
	}

	.success {
		color: var(--color-success, #10b981);
		font-size: 0.875rem;
		margin: 0;
	}

	/* ── Auth transition / shimmer ──────────────────────────────────────────── */
	.auth-transition {
		min-height: 100vh;
		background-color: var(--color-dark-bg, #0f1117);
		display: flex;
		flex-direction: column;
	}

	.shimmer-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.5rem;
		background-color: var(--color-dark-surface, #1a1d27);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.shimmer-content {
		flex: 1;
		padding: 2rem 1.5rem;
		max-width: 1120px;
		width: 100%;
		margin: 0 auto;
		box-sizing: border-box;
	}

	.shimmer-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 2rem;
	}

	.shimmer-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem;
	}

	.shimmer-card {
		background: var(--color-dark-surface, #1a1d27);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 140px;
	}

	/* Shimmer animation */
	.shimmer-block {
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 25%,
			rgba(255, 255, 255, 0.09) 50%,
			rgba(255, 255, 255, 0.04) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 6px;
	}

	@keyframes shimmer {
		0%   { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	/* Shimmer block sizes */
	.logo-block  { width: 80px;  height: 20px; }
	.avatar-block { width: 32px; height: 32px; border-radius: 50%; }
	.title-block { width: 200px; height: 24px; }
	.btn-block   { width: 140px; height: 36px; border-radius: 8px; }
	.line-lg     { width: 75%;   height: 16px; }
	.line-sm     { height: 12px; }
	.bar-block   { width: 100%;  height: 6px;  border-radius: 999px; margin-top: 4px; }
	.line-xs     { height: 11px; margin-top: 2px; }

	.auth-status {
		text-align: center;
		color: var(--color-neutral-500, #6b7280);
		font-size: 0.8rem;
		padding: 1rem;
		margin: 0;
	}

	@media (max-width: 640px) {
		.shimmer-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
