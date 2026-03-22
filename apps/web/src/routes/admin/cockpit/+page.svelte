<script lang="ts">
	import { auth } from '$lib/firebase';
	import type { CockpitDetail } from '$lib/server/admin-cockpit';
	import InterviewList from '$lib/components/admin/InterviewList.svelte';
	import InterviewDetail from '$lib/components/admin/InterviewDetail.svelte';

	let { data } = $props();

	let selectedId = $state<string | null>(null);
	let detail = $state<CockpitDetail | null>(null);
	let loadingDetail = $state(false);

	async function getToken() {
		return (await auth.currentUser?.getIdToken(false)) ?? '';
	}

	async function selectInterview(id: string) {
		if (selectedId === id) return;
		selectedId = id;
		detail = null;
		loadingDetail = true;
		try {
			const token = await getToken();
			const res = await fetch(`/api/admin/cockpit/interviews/${id}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (res.ok) detail = await res.json();
		} finally {
			loadingDetail = false;
		}
	}
</script>

<svelte:head>
	<title>Cockpit — oute.pro</title>
</svelte:head>

<div class="page">
	<div class="cockpit">
		<InterviewList
			interviews={data.interviews}
			{selectedId}
			onselect={selectInterview}
		/>
		<InterviewDetail
			{detail}
			{loadingDetail}
			{selectedId}
			{getToken}
		/>
	</div>
</div>

<style>
	.page {
		padding: 2rem 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.cockpit {
		display: grid;
		grid-template-columns: 360px 1fr;
		gap: 1.5rem;
		align-items: start;
	}
</style>
