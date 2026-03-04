<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, X, Bell, Settings } from 'lucide-svelte';
  import { isPushSupported, isSubscribed, subscribePush, getPermissionStatus } from '$lib/services/push';
  import { goto } from '$app/navigation';
  import { canInstall, isStandalone as isStandaloneStore, triggerInstall } from '$lib/stores/pwa-install';

  let showBanner = $state(false);
  let dismissed = $state(false);
  let showNotifPrompt = $state(false);
  let notifDismissed = $state(false);
  let permissionDenied = $state(false);

  // Show install banner when canInstall becomes true (from shared store)
  $effect(() => {
    if ($canInstall && !dismissed && !$isStandaloneStore) {
      const dismissedAt = typeof window !== 'undefined' ? localStorage.getItem('pwa.installDismissed') : null;
      if (dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000) return;
      showBanner = true;
    } else {
      showBanner = false;
    }
  });

  onMount(async () => {
    if (typeof window === 'undefined') return;

    // Check notification subscription — show prompt if not subscribed (every app open)
    if (isPushSupported()) {
      const notifDismissedAt = localStorage.getItem('pwa.notifDismissed');
      // Dismiss only lasts 24 hours — prompt again next day
      const recentlyDismissed = notifDismissedAt && Date.now() - parseInt(notifDismissedAt) < 24 * 60 * 60 * 1000;

      if (!recentlyDismissed) {
        const subscribed = await isSubscribed();
        if (!subscribed) {
          permissionDenied = Notification.permission === 'denied';
          setTimeout(() => { showNotifPrompt = true; }, 2000);
        }
      }
    }
  });

  async function handleInstall() {
    const result = await triggerInstall();
    if (result === 'accepted') {
      showBanner = false;
    }
  }

  function handleDismiss() {
    showBanner = false;
    dismissed = true;
    localStorage.setItem('pwa.installDismissed', Date.now().toString());
  }

  async function handleEnableNotifications() {
    if (permissionDenied) {
      // Permission blocked — navigate to settings page with instructions
      goto('/account?tab=notifications');
      showNotifPrompt = false;
      notifDismissed = true;
      return;
    }
    const ok = await subscribePush();
    showNotifPrompt = false;
    notifDismissed = true;
    if (!ok) {
      localStorage.setItem('pwa.notifDismissed', Date.now().toString());
    }
  }

  function handleGoToSettings() {
    showNotifPrompt = false;
    notifDismissed = true;
    goto('/account?tab=notifications');
  }

  function handleNotifDismiss() {
    showNotifPrompt = false;
    notifDismissed = true;
    localStorage.setItem('pwa.notifDismissed', Date.now().toString());
  }
</script>

{#if showBanner && !dismissed}
  <div class="install-banner">
    <div class="install-content">
      <Download size={20} />
      <span>ติดตั้ง Grid Pro เป็นแอปบนอุปกรณ์ของคุณ</span>
    </div>
    <div class="install-actions">
      <button class="install-btn" onclick={handleInstall}>ติดตั้ง</button>
      <button class="dismiss-btn" onclick={handleDismiss}>
        <X size={16} />
      </button>
    </div>
  </div>
{/if}

{#if showNotifPrompt && !notifDismissed}
  <div class="install-banner notif-banner">
    <div class="install-content">
      <Bell size={20} />
      {#if permissionDenied}
        <span>การแจ้งเตือนถูกบล็อก กรุณาเปิดในการตั้งค่า</span>
      {:else}
        <span>เปิดรับแจ้งเตือนเพื่อไม่พลาดข่าวสาร</span>
      {/if}
    </div>
    <div class="install-actions">
      {#if permissionDenied}
        <button class="install-btn" onclick={handleGoToSettings}>
          <Settings size={14} style="display:inline;vertical-align:-2px;" /> ตั้งค่า
        </button>
      {:else}
        <button class="install-btn" onclick={handleEnableNotifications}>เปิดแจ้งเตือน</button>
      {/if}
      <button class="dismiss-btn" onclick={handleNotifDismiss}>
        <X size={16} />
      </button>
    </div>
  </div>
{/if}

<style>
  .install-banner {
    position: fixed;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-primary, #4f46e5);
    color: white;
    padding: 10px 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 1000;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    max-width: 90vw;
    animation: slideUp 0.3s ease-out;
  }
  .install-content {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }
  .install-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .install-btn {
    background: white;
    color: var(--color-primary, #4f46e5);
    border: none;
    padding: 6px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
  }
  .dismiss-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
  }
  .dismiss-btn:hover { color: white; }
  @keyframes slideUp {
    from { transform: translateX(-50%) translateY(20px); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  @media (min-width: 1024px) {
    .install-banner { bottom: 24px; }
  }
</style>
