<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '@oute/ui';
	import { auth } from '$lib/firebase';

	let { data } = $props();

	let full_name = $state('');
	let company = $state('');
	let role = $state('');
	let loading = $state(false);
	let error = $state('');

	async function submit() {
		if (!full_name.trim()) {
			error = 'Nome completo é obrigatório.';
			return;
		}

		loading = true;
		error = '';

		try {
			const token = await auth.currentUser?.getIdToken(false);
			const res = await fetch('/api/users/me', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({
					full_name: full_name.trim(),
					company: company.trim(),
					role: role.trim(),
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || 'Erro ao salvar');
			}

			await goto('/pending');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Complete seu cadastro — oute.pro</title>
</svelte:head>

<div class="page">
	<div class="card">
		<h1 class="brand">oute.pro</h1>
		<h2 class="title">Complete seu cadastro</h2>
		<p class="subtitle">Conte um pouco mais sobre você para começar.</p>

		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="form">
			<div class="field">
				<label for="full_name">Nome completo <span class="required">*</span></label>
				<input
					id="full_name"
					type="text"
					bind:value={full_name}
					placeholder="João Silva"
					disabled={loading}
					autocomplete="name"
					required
				/>
			</div>

			<div class="field">
				<label for="company">Empresa <span class="optional">(opcional)</span></label>
				<input
					id="company"
					type="text"
					bind:value={company}
					placeholder="Acme Corp"
					disabled={loading}
					autocomplete="organization"
				/>
			</div>

			<div class="field">
				<label for="role">Cargo <span class="optional">(opcional)</span></label>
				<input
					id="role"
					type="text"
					bind:value={role}
					placeholder="CTO, PM, Dev..."
					disabled={loading}
					autocomplete="organization-title"
				/>
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<Button type="submit" disabled={loading} size="lg" style="width: 100%;">
				{loading ? 'Salvando…' : 'Continuar'}
			</Button>
		</form>
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
		gap: 1.5rem;
		padding: 3rem 2.5rem;
		background-color: var(--color-dark-surface, #1a1d27);
		border-radius: 12px;
		border: 1px solid var(--color-dark-border, rgba(255, 255, 255, 0.08));
		width: 100%;
		max-width: 400px;
	}

	.brand {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary-500, #6366f1);
		margin: 0;
	}

	.title {
		font-size: 1.25rem;
		font-weight: 600;
		color: #f9fafb;
		margin: 0;
		text-align: center;
	}

	.subtitle {
		color: var(--color-neutral-500, #6b7280);
		margin: 0;
		font-size: 0.9rem;
		text-align: center;
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

	.required {
		color: var(--color-error, #ef4444);
	}

	.optional {
		color: var(--color-neutral-600, #4b5563);
		font-size: 0.8rem;
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
