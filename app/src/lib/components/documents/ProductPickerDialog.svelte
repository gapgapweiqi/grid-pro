<script lang="ts">
  import { X, Search, Package, Wrench, Plus, Minus, ShoppingCart, Check } from 'lucide-svelte';
  import type { Product, PickedItem } from '$lib/types';
  import { formatMoney } from '$lib/utils/format';

  let {
    open = false,
    products = [],
    onconfirm = (_items: PickedItem[]) => {},
    oncancel = () => {},
  }: {
    open?: boolean;
    products: Product[];
    onconfirm?: (items: PickedItem[]) => void;
    oncancel?: () => void;
  } = $props();

  let activeTab: 'product' | 'service' = $state('product');
  let searchQuery = $state('');
  let cart: Map<string, number> = $state(new Map());

  // Filter products by tab and search
  let filteredProducts = $derived.by(() => {
    const tabCategory = activeTab === 'product' ? 'สินค้า' : 'บริการ';
    let result = products.filter(p => {
      const cat = (p.json?.category as string) || 'สินค้า';
      return cat === tabCategory;
    });
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        ((p.json?.sku as string) || '').toLowerCase().includes(q)
      );
    }
    return result;
  });

  let totalItems = $derived(() => {
    let sum = 0;
    cart.forEach(qty => { sum += qty; });
    return sum;
  });

  let totalAmount = $derived(() => {
    let sum = 0;
    cart.forEach((qty, id) => {
      const p = products.find(pr => pr.entityId === id);
      if (p) sum += qty * ((p.json?.price as number) || 0);
    });
    return sum;
  });

  function addToCart(productId: string) {
    const current = cart.get(productId) || 0;
    cart = new Map(cart).set(productId, current + 1);
  }

  function removeFromCart(productId: string) {
    const current = cart.get(productId) || 0;
    if (current <= 1) {
      const next = new Map(cart);
      next.delete(productId);
      cart = next;
    } else {
      cart = new Map(cart).set(productId, current - 1);
    }
  }

  function getQty(productId: string): number {
    return cart.get(productId) || 0;
  }

  function handleConfirm() {
    const items: PickedItem[] = [];
    cart.forEach((qty, id) => {
      const p = products.find(pr => pr.entityId === id);
      if (p && qty > 0) {
        items.push({
          productId: p.entityId,
          name: p.name,
          code: p.code || (p.json?.sku as string) || '',
          description: (p.json?.description as string) || '',
          unit: (p.json?.unit as string) || '',
          unitPrice: (p.json?.price as number) || 0,
          qty,
          category: (p.json?.category as string) || 'สินค้า'
        });
      }
    });
    onconfirm(items);
    cart = new Map();
    searchQuery = '';
  }

  function handleClose() {
    oncancel();
    cart = new Map();
    searchQuery = '';
  }

  // Reset when opened
  $effect(() => {
    if (open) {
      cart = new Map();
      searchQuery = '';
      activeTab = 'product';
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker-overlay" onclick={handleClose}>
    <div class="picker-dialog" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="picker-header">
        <h3>เลือกสินค้า / บริการ</h3>
        <button class="picker-close" onclick={handleClose}>
          <X size={20} />
        </button>
      </div>

      <!-- Search -->
      <div class="picker-search">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          placeholder="ค้นหาชื่อ, รหัส..."
          bind:value={searchQuery}
        />
      </div>

      <!-- Tabs -->
      <div class="picker-tabs">
        <button
          class="picker-tab"
          class:active={activeTab === 'product'}
          onclick={() => activeTab = 'product'}
        >
          <Package size={16} />
          สินค้า
          {#if (() => { let c = 0; cart.forEach((q, id) => { const p = products.find(pr => pr.entityId === id); if (p && (p.json?.category as string) === 'สินค้า') c += q; }); return c; })() > 0}
            <span class="tab-badge">{(() => { let c = 0; cart.forEach((q, id) => { const p = products.find(pr => pr.entityId === id); if (p && (p.json?.category as string) === 'สินค้า') c += q; }); return c; })()}</span>
          {/if}
        </button>
        <button
          class="picker-tab"
          class:active={activeTab === 'service'}
          onclick={() => activeTab = 'service'}
        >
          <Wrench size={16} />
          บริการ
          {#if (() => { let c = 0; cart.forEach((q, id) => { const p = products.find(pr => pr.entityId === id); if (p && (p.json?.category as string) === 'บริการ') c += q; }); return c; })() > 0}
            <span class="tab-badge">{(() => { let c = 0; cart.forEach((q, id) => { const p = products.find(pr => pr.entityId === id); if (p && (p.json?.category as string) === 'บริการ') c += q; }); return c; })()}</span>
          {/if}
        </button>
      </div>

      <!-- Product Grid -->
      <div class="picker-grid">
        {#if filteredProducts.length === 0}
          <div class="picker-empty">
            {searchQuery ? 'ไม่พบรายการที่ค้นหา' : (activeTab === 'product' ? 'ยังไม่มีสินค้า' : 'ยังไม่มีบริการ')}
          </div>
        {:else}
          {#each filteredProducts as p (p.entityId)}
            {@const qty = getQty(p.entityId)}
            {@const price = (p.json?.price as number) || 0}
            {@const stockEnabled = p.json?.stockEnabled as boolean}
            {@const stockQty = (p.json?.stockQty as number) || 0}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="picker-card"
              class:selected={qty > 0}
              onclick={() => addToCart(p.entityId)}
            >
              {#if qty > 0}
                <div class="card-qty-badge">{qty}</div>
              {/if}
              <div class="card-icon">
                {#if p.json?.imageUrl}
                  <img src={p.json.imageUrl as string} alt={p.name} />
                {:else}
                  {#if activeTab === 'product'}
                    <Package size={24} />
                  {:else}
                    <Wrench size={24} />
                  {/if}
                {/if}
              </div>
              <div class="card-code">{p.code || (p.json?.sku as string) || '-'}</div>
              <div class="card-name">{p.name}</div>
              <div class="card-price">{formatMoney(price)}</div>
              {#if stockEnabled}
                <div class="card-stock" class:low={stockQty <= ((p.json?.minStock as number) || 0)}>
                  คงเหลือ {stockQty}
                </div>
              {/if}
              {#if qty > 0}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="card-qty-controls" onclick={(e) => e.stopPropagation()}>
                  <button class="qty-btn" onclick={() => removeFromCart(p.entityId)}>
                    <Minus size={14} />
                  </button>
                  <span class="qty-num">{qty}</span>
                  <button class="qty-btn" onclick={() => addToCart(p.entityId)}>
                    <Plus size={14} />
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div class="picker-footer">
        <div class="footer-info">
          <ShoppingCart size={16} />
          <span>{totalItems()} รายการ</span>
          <span class="footer-amount">{formatMoney(totalAmount())}</span>
        </div>
        <button
          class="picker-confirm-btn"
          onclick={handleConfirm}
          disabled={totalItems() === 0}
        >
          <Check size={16} />
          ยืนยัน ({totalItems()})
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .picker-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    padding: 12px;
  }

  .picker-dialog {
    background: #fff;
    width: 100%;
    max-width: 560px;
    max-height: calc(100vh - 24px);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.2);
    animation: pickerSlideIn 0.2s ease-out;
    overflow: hidden;
  }

  @keyframes pickerSlideIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 10px;
  }
  .picker-header h3 {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }
  .picker-close {
    background: none;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s;
  }
  .picker-close:hover { background: #f3f4f6; color: #111827; }

  .picker-search {
    position: relative;
    padding: 0 20px;
    margin-bottom: 10px;
  }
  .picker-search :global(.search-icon) {
    position: absolute;
    left: 32px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
  }
  .picker-search input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
    background: #f9fafb;
  }
  .picker-search input:focus {
    border-color: var(--color-primary, #0ea5e9);
    background: #fff;
  }

  .picker-tabs {
    display: flex;
    gap: 6px;
    padding: 0 20px;
    margin-bottom: 10px;
  }
  .picker-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    background: #fff;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .picker-tab:hover { background: #f9fafb; border-color: #d1d5db; }
  .picker-tab.active {
    background: var(--color-primary-soft, #e0f2fe);
    border-color: var(--color-primary, #0ea5e9);
    color: var(--color-primary, #0ea5e9);
  }
  .tab-badge {
    background: var(--color-primary, #0ea5e9);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
  }

  .picker-grid {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 20px 12px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    align-content: flex-start;
    min-height: 180px;
    max-height: 360px;
  }

  .picker-empty {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    color: #9ca3af;
    font-size: 13px;
  }

  .picker-card {
    position: relative;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 10px 8px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    transition: all 0.15s;
    background: #fff;
    text-align: center;
    user-select: none;
    overflow: visible;
  }
  .picker-card:hover {
    border-color: #d1d5db;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
  .picker-card.selected {
    border-color: var(--color-primary, #0ea5e9);
    background: #f0f9ff;
  }

  .card-qty-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: var(--color-primary, #0ea5e9);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    z-index: 2;
  }

  .card-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    overflow: hidden;
    flex-shrink: 0;
  }
  .card-icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .selected .card-icon {
    background: #dbeafe;
    color: var(--color-primary, #0ea5e9);
  }

  .card-code {
    font-size: 9px;
    color: #9ca3af;
    font-weight: 500;
    letter-spacing: 0.3px;
  }
  .card-name {
    font-size: 11px;
    font-weight: 600;
    color: #374151;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 28px;
  }
  .card-price {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-primary, #0ea5e9);
  }
  .card-stock {
    font-size: 9px;
    color: #6b7280;
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .card-stock.low {
    color: #dc2626;
    background: #fef2f2;
  }

  .card-qty-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }
  .qty-btn {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #374151;
    transition: all 0.1s;
  }
  .qty-btn:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }
  .qty-num {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    min-width: 16px;
    text-align: center;
  }

  .picker-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    border-top: 1px solid #f3f4f6;
    background: #fafbfc;
  }
  .footer-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #6b7280;
  }
  .footer-amount {
    font-weight: 700;
    color: #111827;
    font-size: 13px;
  }
  .picker-confirm-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 20px;
    background: var(--color-primary, #0ea5e9);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .picker-confirm-btn:hover { filter: brightness(1.08); }
  .picker-confirm-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    filter: none;
  }

  @media (max-width: 600px) {
    .picker-overlay { padding: 8px; }
    .picker-dialog {
      max-width: 100%;
      border-radius: 14px;
      max-height: calc(100vh - 16px);
    }
    .picker-header { padding: 14px 16px 8px; }
    .picker-header h3 { font-size: 14px; }
    .picker-search { padding: 0 16px; margin-bottom: 8px; }
    .picker-tabs { padding: 0 16px; margin-bottom: 8px; }
    .picker-tab { padding: 7px 10px; font-size: 12px; }
    .picker-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      padding: 6px 16px 10px;
      max-height: 320px;
    }
    .picker-card { padding: 8px 6px 6px; border-radius: 8px; }
    .card-icon { width: 30px; height: 30px; border-radius: 6px; }
    .card-name { font-size: 10px; min-height: 26px; }
    .card-price { font-size: 11px; }
    .picker-footer { padding: 8px 16px; }
    .picker-confirm-btn { padding: 7px 16px; font-size: 12px; }
  }
</style>
