<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { sidebarMobileOpen, companies, currentCompanyId, closeMobileSidebar, addToast, isOwner, activeTeamPermissions, canAccessPage, showUpgradeDialog } from '$lib/stores/app';
  import { X, LogOut, ArrowRight, Sparkles, Briefcase } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';
  import { logout, currentUser } from '$lib/stores/auth';
  import { isSandbox } from '$lib/stores/sandbox';
  import { isInstalled, isStandalone } from '$lib/stores/pwa-install';
  import { NAV_ITEMS, SANDBOX_NAV_ITEMS, ADMIN_NAV_ITEMS } from '$lib/config/nav';

  let isAdmin = $derived($currentUser?.isAdmin === true);
  let userIsOwner = $derived($isOwner);
  let userHasTeamAccess = $derived(!!$currentUser?.hasTeamAccess);
  let showUpgrade = $derived(!userIsOwner && !isAdmin);

  let navItems = $derived($isSandbox ? SANDBOX_NAV_ITEMS : NAV_ITEMS);

  function handleLogout() {
    closeMobileSidebar();
    logout();
    addToast('ออกจากระบบแล้ว', 'info');
    goto('/login');
  }

  function handleNav(path: string) {
    closeMobileSidebar();
  }

  function onCompanyChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    currentCompanyId.set(select.value);
    // Persist selection so it survives PWA page reloads
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentCompanyId', select.value);
    }
    // Close menu and hard-reload to ensure all data refreshes for the new company
    closeMobileSidebar();
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if $sidebarMobileOpen}
  <div class="bottom-sheet-overlay" transition:fade={{ duration: 200 }} onclick={closeMobileSidebar}></div>
  <div class="bottom-sheet" transition:slide={{ duration: 250, axis: 'y' }}>
    <div class="bottom-sheet-header">
      <div class="bottom-sheet-drag-handle"></div>
      <div class="bottom-sheet-title">เมนูเพิ่มเติม</div>
      <button class="bottom-sheet-close" onclick={closeMobileSidebar}>
        <X size={20} />
      </button>
    </div>

    <div class="bottom-sheet-content">
      {#if $companies.length > 0}
        <div class="bottom-sheet-company">
          <div class="bottom-sheet-company-label">บริษัทที่ใช้งานอยู่</div>
          <div class="company-select-wrapper">
            <Briefcase size={16} class="company-icon" />
            <select class="company-select" value={$currentCompanyId} onchange={onCompanyChange}>
              {#if $companies.length > 1}
                <option value="__all__">ทุกบริษัท</option>
              {/if}
              {#each $companies as company}
                <option value={company.entityId}>{company.name}</option>
              {/each}
            </select>
          </div>
        </div>
      {/if}

      <div class="bottom-sheet-nav">
        {#each navItems.filter(item => {
          if (item.path === '/install' && ($isInstalled || $isStandalone)) return false;
          if (userIsOwner || isAdmin || !userHasTeamAccess) return true;
          return item.path ? canAccessPage(item.path, false, $activeTeamPermissions) : true;
        }) as item}
          {#if item.dividerBefore}
            <div class="nav-divider"></div>
          {/if}
          <a
            href={item.path}
            class="nav-item"
            class:active={$page.url.pathname === item.path}
            onclick={() => handleNav(item.path)}
          >
            <span class="nav-icon">
              {#if item.icon}
                {@const Icon = item.icon}
                <Icon size={20} />
              {/if}
            </span>
            <span class="nav-label">{item.label}</span>
          </a>
        {/each}
        {#if isAdmin && !$isSandbox}
          <div class="nav-divider"></div>
          {#each ADMIN_NAV_ITEMS as item}
            <a
              href={item.path}
              class="nav-item"
              class:active={$page.url.pathname === item.path}
              onclick={() => handleNav(item.path)}
            >
              <span class="nav-icon">
                {#if item.icon}
                  {@const Icon = item.icon}
                  <Icon size={20} />
                {/if}
              </span>
              <span class="nav-label">{item.label}</span>
            </a>
          {/each}
        {/if}
        <div class="nav-divider"></div>
        {#if showUpgrade && !$isSandbox}
          <button
            class="nav-item upgrade-mobile-btn"
            onclick={() => { closeMobileSidebar(); showUpgradeDialog.set(true); }}
          >
            <span class="nav-icon"><Sparkles size={20} /></span>
            <span class="nav-label">อัพเกรดเป็น Owner</span>
          </button>
        {/if}
        {#if $isSandbox}
          <a
            href="/login"
            class="nav-item signup-mobile-btn"
            onclick={() => closeMobileSidebar()}
          >
            <span class="nav-icon"><ArrowRight size={20} /></span>
            <span class="nav-label">สมัครใช้งาน</span>
          </a>
        {:else}
          <button
            class="nav-item logout-mobile-btn"
            onclick={handleLogout}
          >
            <span class="nav-icon"><LogOut size={20} /></span>
            <span class="nav-label">ออกจากระบบ</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .bottom-sheet-overlay {
    display: none;
  }

  .bottom-sheet {
    display: none;
  }

  @media (max-width: 1024px) {
    .bottom-sheet-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 50;
    }

    .bottom-sheet {
      display: flex;
      flex-direction: column;
      position: fixed;
      bottom: 0;
      left: 12px;
      right: 12px;
      background: #fff;
      border-radius: 20px 20px 0 0;
      z-index: 51;
      max-height: 85vh;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
      padding-bottom: env(safe-area-inset-bottom);
    }

    .bottom-sheet-header {
      position: relative;
      padding: 16px;
      text-align: center;
      border-bottom: 1px solid var(--color-gray-100);
      flex-shrink: 0;
    }

    .bottom-sheet-drag-handle {
      width: 40px;
      height: 4px;
      background: var(--color-gray-300);
      border-radius: 2px;
      margin: 0 auto 12px auto;
    }

    .bottom-sheet-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--color-gray-900);
    }

    .bottom-sheet-close {
      position: absolute;
      right: 16px;
      top: 16px;
      background: none;
      border: none;
      color: var(--color-gray-500);
      padding: 4px;
      cursor: pointer;
    }

    .bottom-sheet-content {
      overflow-y: auto;
      padding: 16px;
      flex: 1;
    }

    .bottom-sheet-company {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--color-gray-100);
    }

    .bottom-sheet-company-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-gray-500);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .company-select-wrapper {
      position: relative;
      background: var(--color-gray-50);
      border: 1px solid var(--color-gray-200);
      border-radius: 12px;
      display: flex;
      align-items: center;
      padding: 0 12px;
    }

    .company-select {
      width: 100%;
      padding: 12px 12px 12px 8px;
      background: transparent;
      border: none;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-gray-900);
      appearance: none;
      outline: none;
    }

    .bottom-sheet-nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      text-decoration: none;
      color: var(--color-gray-700);
      font-size: 14px;
      font-weight: 500;
      border-radius: 10px;
      transition: all 0.2s;
    }

    .nav-item:active {
      background: var(--color-gray-50);
    }

    .nav-item.active {
      background: var(--color-primary-soft);
      color: var(--color-primary);
      font-weight: 600;
    }

    .nav-icon {
      color: var(--color-gray-400);
    }

    .nav-item.active .nav-icon {
      color: var(--color-primary);
    }

    .nav-divider {
      height: 1px;
      background: var(--color-gray-100);
      margin: 8px 0;
    }

    .logout-mobile-btn {
      background: none;
      border: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
      color: #dc2626;
      font-weight: 600;
      letter-spacing: 0.1px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      transition: color 0.18s ease;
    }
    .logout-mobile-btn:active,
    .logout-mobile-btn:hover {
      color: #b91c1c;
    }

    .signup-mobile-btn {
      background: linear-gradient(135deg, #10b981, #059669) !important;
      color: #fff !important;
      font-weight: 600 !important;
      border-radius: 10px;
      text-decoration: none;
    }
    .signup-mobile-btn .nav-icon {
      color: #fff;
    }
    .signup-mobile-btn:hover {
      background: linear-gradient(135deg, #059669, #047857) !important;
    }

    .upgrade-mobile-btn {
      background: linear-gradient(135deg, #f59e0b, #d97706) !important;
      color: #fff !important;
      font-weight: 600 !important;
      border-radius: 10px;
      border: none;
      font-family: inherit;
      cursor: pointer;
      width: 100%;
      text-align: left;
    }
    .upgrade-mobile-btn .nav-icon {
      color: #fff;
    }
    .upgrade-mobile-btn:hover {
      background: linear-gradient(135deg, #d97706, #b45309) !important;
    }
  }
</style>
