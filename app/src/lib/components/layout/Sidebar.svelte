<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { sidebarCollapsed, toggleSidebar, companies, currentCompanyId, addToast, isOwner, activeTeamPermissions, canAccessPage, showUpgradeDialog } from '$lib/stores/app';
  import { PanelLeftClose, PanelLeftOpen, FileText, LogOut, ArrowRight, Sparkles, Briefcase } from 'lucide-svelte';
  import { logout, currentUser } from '$lib/stores/auth';
  import { isSandbox } from '$lib/stores/sandbox';
  import { isInstalled, isStandalone } from '$lib/stores/pwa-install';
  import { NAV_ITEMS, SANDBOX_NAV_ITEMS, ADMIN_NAV_ITEMS } from '$lib/config/nav';

  let isAdmin = $derived($currentUser?.isAdmin === true);
  let userIsOwner = $derived($isOwner);
  let userHasTeamAccess = $derived(!!$currentUser?.hasTeamAccess);
  let showUpgrade = $derived(!userIsOwner && !isAdmin);

  let headerHovered = $state(false);

  function onCompanyChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    currentCompanyId.set(select.value);
    // Persist selection so it survives page reloads / PWA navigation
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentCompanyId', select.value);
    }
  }
</script>

<aside class="sidebar" class:collapsed={$sidebarCollapsed}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sidebar-header"
    onmouseenter={() => headerHovered = true}
    onmouseleave={() => headerHovered = false}
    onclick={() => { if ($sidebarCollapsed) toggleSidebar(); }}
    role={$sidebarCollapsed ? 'button' : undefined}
    style={$sidebarCollapsed ? 'cursor:pointer;' : ''}
  >
    <div class="logo-icon">
      {#if $sidebarCollapsed && headerHovered}
        <PanelLeftOpen size={18} />
      {:else}
        <FileText size={$sidebarCollapsed ? 18 : 20} />
      {/if}
    </div>
    <div class="logo-text">
      <div class="sidebar-brand">Grid Doc</div>
      <div class="sidebar-subtitle">จัดการธุรกิจอย่างมืออาชีพ</div>
    </div>
    {#if !$sidebarCollapsed}
      <button type="button" class="sidebar-toggle-header" onclick={(e) => { e.stopPropagation(); toggleSidebar(); }} title="ย่อ Sidebar">
        <PanelLeftClose size={18} />
      </button>
    {/if}
  </div>

  {#if $companies.length > 0 && !$sidebarCollapsed}
    <div class="company-switcher">
      <Briefcase size={14} />
      <select value={$currentCompanyId} onchange={onCompanyChange}>
        {#if $companies.length > 1}
          <option value="__all__">ทุกบริษัท</option>
        {/if}
        {#each $companies as company}
          <option value={company.entityId}>{company.name}</option>
        {/each}
      </select>
    </div>
  {/if}

  <nav class="sidebar-nav" data-tour="sidebar-nav">
    {#each ($isSandbox ? SANDBOX_NAV_ITEMS : NAV_ITEMS).filter(item => {
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
      >
        <span class="nav-icon">
          {#if item.icon}
            {@const Icon = item.icon}
            <Icon size={18} />
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
        >
          <span class="nav-icon">
            {#if item.icon}
              {@const Icon = item.icon}
              <Icon size={18} />
            {/if}
          </span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    {/if}
  </nav>

  <div class="sidebar-bottom-action">
    {#if showUpgrade && !$isSandbox}
      <button
        type="button"
        class="upgrade-btn-clean"
        class:collapsed={$sidebarCollapsed}
        onclick={() => showUpgradeDialog.set(true)}
      >
        <span class="logout-icon"><Sparkles size={18} /></span>
        <span class="logout-label">อัพเกรด</span>
      </button>
    {/if}
    {#if $isSandbox}
      <a
        href="/login"
        class="signup-btn-clean"
        class:collapsed={$sidebarCollapsed}
      >
        <span class="logout-icon"><ArrowRight size={18} /></span>
        <span class="logout-label">สมัครใช้งาน</span>
      </a>
    {:else}
      <button
        type="button"
        class="logout-btn-clean"
        class:collapsed={$sidebarCollapsed}
        onclick={() => { logout(); addToast('ออกจากระบบแล้ว', 'info'); goto('/login'); }}
      >
        <span class="logout-icon"><LogOut size={18} /></span>
        <span class="logout-label">ออกจากระบบ</span>
      </button>
    {/if}
  </div>

  <div class="sidebar-footer">
    <div class="sidebar-footnote">Grid Pro v2.0</div>
  </div>
</aside>

<style>
  .nav-item {
    text-decoration: none;
  }
  .sidebar-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 12px 0;
    display: flex;
    justify-content: center;
  }

  .sidebar-bottom-action {
    padding: 0 12px 16px 12px;
  }

  .logout-btn-clean {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    color: #f87171; /* Softer red for dark bg */
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
    font-family: inherit;
  }
  .logout-btn-clean:hover {
    color: #fecaca;
  }
  .logout-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
  }
  .logout-btn-clean.collapsed {
    justify-content: center;
    padding: 10px 0;
  }
  .logout-btn-clean.collapsed .logout-label {
    display: none;
  }

  .signup-btn-clean {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    text-decoration: none;
  }
  .signup-btn-clean:hover {
    background: linear-gradient(135deg, #059669, #047857);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }
  .signup-btn-clean.collapsed {
    justify-content: center;
    padding: 10px 0;
  }
  .signup-btn-clean.collapsed .logout-label {
    display: none;
  }


  .upgrade-btn-clean {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    margin-bottom: 8px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }
  .upgrade-btn-clean:hover {
    background: linear-gradient(135deg, #d97706, #b45309);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  }
  .upgrade-btn-clean.collapsed {
    justify-content: center;
    padding: 10px 0;
  }
  .upgrade-btn-clean.collapsed .logout-label {
    display: none;
  }
</style>
