<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { restoreAuth } from '$lib/stores/auth';

	onMount(() => {
		const hasAuth = restoreAuth();
		if (hasAuth) {
			goto('/dashboard', { replaceState: true });
		} else {
			// In Tauri/PWA standalone — skip landing, go straight to login
			const isStandalone = window.matchMedia('(display-mode: standalone)').matches
				|| ('standalone' in navigator && (navigator as any).standalone === true);
			const inTauri = '__TAURI_INTERNALS__' in window
				|| window.location.protocol === 'tauri:'
				|| window.location.hostname === 'tauri.localhost'
				|| navigator.userAgent.includes('Tauri');
			const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
			if (isStandalone || inTauri || isLocalDev) {
				goto('/login', { replaceState: true });
			} else {
				window.location.href = 'https://grid-doc.com';
			}
		}
	});
</script>

<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
	<p style="color: #94a3b8;">กำลังโหลด...</p>
</div>
