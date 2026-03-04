<script lang="ts">
  import { page } from '$app/stores';
  import { Plus, MoreHorizontal } from 'lucide-svelte';
  import { sidebarMobileOpen, isOwner, activeTeamPermissions, canAccessPage } from '$lib/stores/app';
  import { isSandbox } from '$lib/stores/sandbox';
  import { currentUser } from '$lib/stores/auth';
  import { NAV_ITEMS, SANDBOX_NAV_ITEMS } from '$lib/config/nav';

  let userIsOwner = $derived($isOwner);
  let userHasTeamAccess = $derived(!!$currentUser?.hasTeamAccess);
  let isAdmin = $derived($currentUser?.isAdmin === true);

  // Build bottom nav items from shared config: items with showOnBottomNav + "More" button
  let bottomItems = $derived.by(() => {
    const source = $isSandbox ? SANDBOX_NAV_ITEMS : NAV_ITEMS;
    const filtered = source
      .filter(item => item.showOnBottomNav)
      .filter(item => {
        if (userIsOwner || isAdmin || !userHasTeamAccess) return true;
        return item.path ? canAccessPage(item.path, false, $activeTeamPermissions) : true;
      })
      .map(item => ({
        path: item.path,
        label: item.bottomNavFab ? '' : item.label,
        icon: item.bottomNavFab ? Plus : item.icon,
        fab: !!item.bottomNavFab,
        action: undefined as string | undefined
      }));
    // Insert FAB in the middle
    const fabItem = filtered.find(i => i.fab);
    const nonFab = filtered.filter(i => !i.fab);
    const mid = Math.ceil(nonFab.length / 2);
    const result = [...nonFab.slice(0, mid)];
    if (fabItem) result.push(fabItem);
    result.push(...nonFab.slice(mid));
    // Always add "More" at the end
    result.push({ path: '', label: 'เพิ่มเติม', icon: MoreHorizontal, fab: false, action: 'more' });
    return result;
  });

  function handleClick(item: typeof bottomItems[0]) {
    if (item.action === 'more') {
      sidebarMobileOpen.set(true);
    }
  }
</script>

<nav class="bottom-nav">
  <div class="bottom-nav-items">
    {#each bottomItems as item}
      {#if item.action === 'more'}
        <button
          class="bottom-nav-item"
          onclick={() => handleClick(item)}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </button>
      {:else if item.fab}
        <a href={item.path} class="bottom-nav-item fab">
          <item.icon size={24} />
        </a>
      {:else}
        <a
          href={item.path}
          class="bottom-nav-item"
          class:active={$page.url.pathname === item.path}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </a>
      {/if}
    {/each}
  </div>
</nav>

<style>
  .bottom-nav-item {
    text-decoration: none;
  }
</style>
