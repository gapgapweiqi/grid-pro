<script lang="ts">
  import { page } from '$app/stores';
  import { sidebarMobileOpen, topbarActions, topbarCustomContent } from '$lib/stores/app';
  import { Menu, Plus, ArrowRight, Home } from 'lucide-svelte';
  import { isSandbox } from '$lib/stores/sandbox';

  const viewTitles: Record<string, { title: string; subtitle: string }> = {
    '/': { title: 'แดชบอร์ด', subtitle: 'ภาพรวมธุรกิจแบบมืออาชีพ' },
    '/sandbox': { title: 'Sandbox', subtitle: 'โหมดทดลองใช้งาน' },
    '/documents': { title: 'ออกเอกสาร', subtitle: 'สร้าง/พรีวิว/พิมพ์ได้ในหน้าเดียว' },
    '/documents/history': { title: 'ประวัติเอกสาร', subtitle: 'ดูและจัดการเอกสารที่บันทึกไว้' },
    '/payments': { title: 'ติดตามชำระเงิน', subtitle: 'จัดการสถานะการชำระเงิน' },
    '/products': { title: 'สินค้า/บริการ', subtitle: 'จัดการสินค้าและบริการ' },
    '/stock': { title: 'คลังสินค้า', subtitle: 'สต็อก · สั่งซื้อ · ตัดสต็อก' },
    '/customers': { title: 'ลูกค้า/ผู้ขาย', subtitle: 'ข้อมูลลูกค้าเพื่อออกเอกสาร' },
    '/salespersons': { title: 'พนักงานขาย', subtitle: 'จัดการข้อมูลพนักงานขาย' },
    '/companies': { title: 'บริษัทของฉัน', subtitle: 'จัดการข้อมูลบริษัท' },
    '/settings': { title: 'ตั้งค่า', subtitle: 'ฟอนต์ ธีม และค่าเริ่มต้น' },
    '/account': { title: 'บัญชีของฉัน', subtitle: 'จัดการบัญชี ทีม และการแจ้งเตือน' }
  };

  $: currentPath = $page.url.pathname;
  $: titleData = $topbarCustomContent || viewTitles[currentPath] || { title: '', subtitle: '' };
  $: hasBadges = titleData && 'badges' in titleData && titleData.badges && titleData.badges.length > 0;
  $: hasCustomActions = titleData && 'customActions' in titleData && titleData.customActions && titleData.customActions.length > 0;
</script>

{#if $isSandbox}
  <div class="sandbox-banner">
    <a href="https://grid-doc.com" class="sandbox-banner-btn sandbox-back"><Home size={14} /> กลับหน้าหลัก</a>
    <span class="sandbox-banner-text">คุณกำลังใช้โหมดทดลอง — สมัครใช้งานจริงเพียง ฿790 ตลอดชีพ</span>
    <a href="/login" class="sandbox-banner-btn">สมัครเลย <ArrowRight size={14} /></a>
  </div>
{/if}

<header class="topbar">
  <div class="topbar-left">
    <div>
      <div class="topbar-title">{titleData.title}</div>
      {#if hasBadges && 'badges' in titleData}
        <div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
          {#each titleData.badges as badge}
            <span class="badge badge-{badge.color}">{badge.label}</span>
          {/each}
        </div>
      {:else if titleData.subtitle}
        <div class="topbar-subtitle">{titleData.subtitle}</div>
      {/if}
    </div>
  </div>
  <div class="topbar-actions">
    {#if hasCustomActions && 'customActions' in titleData}
      {#each titleData.customActions as ca}
        <button
          class="topbar-custom-btn"
          onclick={ca.onClick}
        >
          {#if ca.icon === 'eye'}
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
          {/if}
          {ca.label}
        </button>
      {/each}
    {/if}
    {#each $topbarActions as action}
      <button 
        class="btn {action.primary ? 'btn-primary' : 'btn-outline'}" 
        onclick={action.onClick}
      >
        {#if action.icon}
          {@const Icon = action.icon}
          <Icon size={16} />
        {/if}
        {action.label}
      </button>
    {/each}
  </div>
</header>

<style>
  .topbar-custom-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--color-primary);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-primary) 8%, white);
    color: var(--color-primary);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .topbar-custom-btn:hover {
    background: color-mix(in srgb, var(--color-primary) 15%, white);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .sandbox-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    flex-wrap: wrap;
  }
  .sandbox-banner-text {
    white-space: nowrap;
  }
  .sandbox-banner-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 14px;
    border-radius: 6px;
    background: rgba(255,255,255,0.2);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .sandbox-banner-btn:hover {
    background: rgba(255,255,255,0.35);
  }
  .sandbox-back {
    margin-right: auto;
  }

  @media (max-width: 640px) {
    .sandbox-banner {
      font-size: 11px;
      padding: 6px 12px;
      gap: 8px;
    }
    .sandbox-banner-btn {
      font-size: 11px;
      padding: 3px 10px;
    }
  }
</style>
