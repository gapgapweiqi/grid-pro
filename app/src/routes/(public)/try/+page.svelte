<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		goto('/sandbox', { replaceState: true });
	});
</script>

<div style="display: flex; align-items: center; justify-content: center; min-height: 60vh;">
	<div style="text-align: center;">
		<div class="loading-spinner" style="margin: 0 auto 16px;"></div>
		<p style="font-size: 14px; color: var(--color-gray-500);">กำลังเข้าสู่โหมดทดลอง...</p>
	</div>
</div>
