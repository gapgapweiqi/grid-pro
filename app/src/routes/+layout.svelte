<script lang="ts">
	import '../app.css';
	import Toast from '$lib/components/layout/Toast.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Grid Doc - จัดการธุรกิจอย่างมืออาชีพ</title>
</svelte:head>

{@render children()}
<Toast />
