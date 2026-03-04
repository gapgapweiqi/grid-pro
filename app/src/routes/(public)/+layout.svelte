<script lang="ts">
	import { onMount } from 'svelte';
	import PublicHeader from '$lib/components/public/PublicHeader.svelte';
	import PublicFooter from '$lib/components/public/PublicFooter.svelte';
	import { restoreAuth } from '$lib/stores/auth';

	let { children } = $props();

	onMount(() => {
		restoreAuth();
	});
</script>

<div class="pub-shell">
	<PublicHeader />
	<main class="pub-main">
		{@render children()}
	</main>
	<PublicFooter />
</div>

<style>
	.pub-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #faf8f4;
		font-family: "Sarabun", "Noto Sans Thai", Arial, sans-serif;
	}
	.pub-main {
		flex: 1;
	}
</style>
