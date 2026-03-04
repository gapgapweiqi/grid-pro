<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { RefreshCw } from 'lucide-svelte';

	let showToast = $state(false);
	let newVersion = $state('');

	function handleUpdate() {
		window.location.reload();
	}

	function handleDismiss() {
		showToast = false;
	}

	let swListener: ((e: MessageEvent) => void) | null = null;

	onMount(() => {
		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

		swListener = (event: MessageEvent) => {
			if (event.data?.type === 'SW_UPDATED') {
				newVersion = event.data.version || '';
				showToast = true;
			}
		};
		navigator.serviceWorker.addEventListener('message', swListener);
	});

	onDestroy(() => {
		if (swListener && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
			navigator.serviceWorker.removeEventListener('message', swListener);
		}
	});
</script>

{#if showToast}
	<div class="update-toast">
		<RefreshCw size={16} />
		<span>มีเวอร์ชันใหม่พร้อมใช้งาน</span>
		<button class="update-btn" onclick={handleUpdate}>อัพเดทเลย</button>
		<button class="dismiss-btn" onclick={handleDismiss}>&times;</button>
	</div>
{/if}

<style>
	.update-toast {
		position: fixed; bottom: 20px; right: 20px; z-index: 10000;
		display: flex; align-items: center; gap: 10px;
		padding: 12px 18px; border-radius: 12px;
		background: #1a4731; color: #fff;
		box-shadow: 0 8px 32px rgba(0,0,0,0.18);
		font-size: 13px; font-weight: 600;
		animation: slideUp 0.3s ease-out;
	}
	.update-btn {
		background: #4ade80; color: #052e16; border: none; border-radius: 6px;
		padding: 5px 14px; font-size: 12px; font-weight: 700; cursor: pointer;
		font-family: inherit; transition: background 0.15s;
	}
	.update-btn:hover { background: #86efac; }
	.dismiss-btn {
		background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer;
		font-size: 18px; padding: 0 4px; line-height: 1;
	}
	.dismiss-btn:hover { color: #fff; }
	@keyframes slideUp {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	@media (max-width: 640px) {
		.update-toast {
			bottom: 70px; right: 12px; left: 12px;
			justify-content: center;
		}
	}
</style>
