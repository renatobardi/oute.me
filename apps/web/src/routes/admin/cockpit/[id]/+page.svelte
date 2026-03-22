<script lang="ts">
	import { auth } from '$lib/firebase';
	import InterviewDetail from '$lib/components/admin/InterviewDetail.svelte';

	let { data } = $props();

	async function getToken() {
		return (await auth.currentUser?.getIdToken(false)) ?? '';
	}
</script>

<svelte:head>
	<title>{data.detail.interview.title ?? 'Entrevista'} — Cockpit oute.pro</title>
</svelte:head>

<div class="page">
	<div class="breadcrumb">
		<a href="/admin/cockpit">← Cockpit</a>
	</div>
	<InterviewDetail
		detail={data.detail}
		loadingDetail={false}
		selectedId={data.detail.interview.id}
		{getToken}
	/>
</div>

<style>
	.page {
		padding: 2rem 1.5rem;
		max-width: 900px;
		margin: 0 auto;
	}

	.breadcrumb {
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.breadcrumb a {
		color: var(--color-neutral-400, #9ca3af);
		text-decoration: none;
	}

	.breadcrumb a:hover {
		color: #f9fafb;
	}
</style>
