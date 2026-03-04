<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Billing page now redirects to marketing pricing page
	// Team seat purchases are handled in Settings > Team tab
	onMount(() => {
		window.location.href = 'https://grid-doc.com/pricing';
	});
</script>

<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
	<p style="color: #94a3b8;">กำลังโหลด...</p>
</div>
