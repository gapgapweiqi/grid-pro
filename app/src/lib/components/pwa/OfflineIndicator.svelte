<script lang="ts">
  import { onMount } from 'svelte';
  import { WifiOff } from 'lucide-svelte';

  let isOffline = $state(false);

  onMount(() => {
    isOffline = !navigator.onLine;
    const goOffline = () => { isOffline = true; };
    const goOnline = () => { isOffline = false; };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  });
</script>

{#if isOffline}
  <div class="offline-bar">
    <WifiOff size={14} />
    <span>ออฟไลน์ — ข้อมูลจาก cache</span>
  </div>
{/if}

<style>
  .offline-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #f59e0b;
    color: #1a1a1a;
    padding: 4px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    z-index: 9999;
    animation: slideDown 0.2s ease-out;
  }
  @keyframes slideDown {
    from { transform: translateY(-100%); }
    to { transform: translateY(0); }
  }
</style>
