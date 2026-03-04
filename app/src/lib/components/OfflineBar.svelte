<script lang="ts">
	import { WifiOff, RefreshCw, CloudOff, X } from 'lucide-svelte';
	import { isOnline, isSyncing, pendingSyncCount, flushSyncQueue } from '$lib/services/sync-manager';

	let dismissed = $state(false);
	let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

	// Reset dismissed state when going offline again
	$effect(() => {
		if (!$isOnline) {
			dismissed = false;
			// Auto-hide after 5 seconds
			if (autoHideTimer) clearTimeout(autoHideTimer);
			autoHideTimer = setTimeout(() => { dismissed = true; }, 5000);
		}
		return () => { if (autoHideTimer) clearTimeout(autoHideTimer); };
	});

	function handleSync() {
		flushSyncQueue();
	}

	function dismiss() {
		dismissed = true;
		if (autoHideTimer) { clearTimeout(autoHideTimer); autoHideTimer = null; }
	}
</script>

{#if !$isOnline && !dismissed}
	<div class="offline-bar offline">
		<WifiOff size={14} />
		<span>ออฟไลน์ — ข้อมูลจากเครื่อง</span>
		{#if $pendingSyncCount > 0}
			<span class="badge">{$pendingSyncCount} รอส่ง</span>
		{/if}
		<button class="dismiss-btn" onclick={dismiss}><X size={14} /></button>
	</div>
{:else if $isSyncing}
	<div class="offline-bar syncing">
		<RefreshCw size={14} class="spin" />
		<span>กำลังซิงค์ข้อมูล...</span>
	</div>
{:else if $pendingSyncCount > 0}
	<div class="offline-bar pending">
		<CloudOff size={14} />
		<span>{$pendingSyncCount} รายการรอส่ง</span>
		<button class="sync-btn" onclick={handleSync}>ซิงค์เลย</button>
	</div>
{/if}

<style>
	.offline-bar {
		display: flex; align-items: center; justify-content: center; gap: 8px;
		padding: 6px 16px; font-size: 12px; font-weight: 600;
		position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
		transition: all 0.3s;
	}
	.offline {
		background: #fef3c7; color: #92400e; border-top: 1px solid #fcd34d;
	}
	.syncing {
		background: #dbeafe; color: #1e40af; border-top: 1px solid #93c5fd;
	}
	.pending {
		background: #fef9c3; color: #854d0e; border-top: 1px solid #fde047;
	}
	.badge {
		background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 10px; font-size: 11px;
	}
	.sync-btn {
		background: #1a4731; color: #fff; border: none; border-radius: 6px;
		padding: 3px 10px; font-size: 11px; font-weight: 600; cursor: pointer;
		font-family: inherit;
	}
	.sync-btn:hover { background: #153d2a; }
	.dismiss-btn {
		width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.1);
		border: none; color: inherit; cursor: pointer;
		display: flex; align-items: center; justify-content: center; padding: 0;
		margin-left: 4px; transition: background 0.15s;
	}
	.dismiss-btn:hover { background: rgba(0,0,0,0.2); }
	:global(.spin) { animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
