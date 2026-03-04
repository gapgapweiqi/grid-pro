<script lang="ts">
	let { children } = $props();
</script>

<div class="auth-shell">
	{@render children()}
</div>

<style>
	.auth-shell {
		min-height: 100vh;
		font-family: "Sarabun", "Noto Sans Thai", Arial, sans-serif;
	}
</style>
