<script lang="ts">
  import { onMount } from 'svelte';
  import type { OverlayItem } from '$lib/types';

  let {
    items = [],
    zoomLevel = 100,
    onchange
  }: {
    items: OverlayItem[];
    zoomLevel?: number;
    onchange?: (items: OverlayItem[]) => void;
  } = $props();

  let selectedId: string | null = $state(null);
  let dragging = $state(false);
  let resizing = $state(false);
  let rotating = $state(false);

  // Global click listener for deselection — fires when clicking anywhere outside overlay items
  onMount(() => {
    function handleGlobalPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-overlay-id]') || target.closest('.overlay-handle')) return;
      if (!dragging && !resizing && !rotating) {
        selectedId = null;
      }
    }
    window.addEventListener('pointerdown', handleGlobalPointerDown, true);
    return () => window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  });

  // Drag state
  let dragStartX = 0;
  let dragStartY = 0;
  let dragItemStartX = 0;
  let dragItemStartY = 0;

  // Resize state
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeItemStartW = 0;
  let resizeItemStartH = 0;

  // Rotate state
  let rotateStartAngle = 0;
  let rotateCenterX = 0;
  let rotateCenterY = 0;
  let rotateItemStartAngle = 0;

  const scale = $derived(zoomLevel / 100);

  function getItem(id: string): OverlayItem | undefined {
    return items.find(i => i.id === id);
  }

  function updateItem(id: string, updates: Partial<OverlayItem>) {
    const newItems = items.map(i => i.id === id ? { ...i, ...updates } : i);
    onchange?.(newItems);
  }

  function selectItem(id: string, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    selectedId = id;
  }

  // ---- DRAG ----
  function startDrag(id: string, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    selectedId = id;
    dragging = true;
    const item = getItem(id);
    if (!item) return;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragItemStartX = item.x;
    dragItemStartY = item.y;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  }

  function onDragMove(e: PointerEvent) {
    if (!dragging || !selectedId) return;
    // Convert pixel delta to mm (1mm ≈ 3.7795px at 96dpi)
    const pxToMm = 1 / (3.7795 * scale);
    const dx = (e.clientX - dragStartX) * pxToMm;
    const dy = (e.clientY - dragStartY) * pxToMm;
    updateItem(selectedId, {
      x: Math.max(0, dragItemStartX + dx),
      y: Math.max(0, dragItemStartY + dy)
    });
  }

  function onDragEnd() {
    dragging = false;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
  }

  // ---- RESIZE ----
  function startResize(id: string, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    selectedId = id;
    resizing = true;
    const item = getItem(id);
    if (!item) return;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeItemStartW = item.width;
    resizeItemStartH = item.height;
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeEnd);
  }

  function onResizeMove(e: PointerEvent) {
    if (!resizing || !selectedId) return;
    const pxToMm = 1 / (3.7795 * scale);
    const dx = (e.clientX - resizeStartX) * pxToMm;
    const dy = (e.clientY - resizeStartY) * pxToMm;
    // Proportional resize using the larger delta
    const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    const aspect = resizeItemStartW / resizeItemStartH;
    const newW = Math.max(10, resizeItemStartW + delta);
    const newH = newW / aspect;
    updateItem(selectedId, { width: newW, height: Math.max(10, newH) });
  }

  function onResizeEnd() {
    resizing = false;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeEnd);
  }

  // ---- ROTATE ----
  function startRotate(id: string, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    selectedId = id;
    rotating = true;
    const item = getItem(id);
    if (!item) return;
    rotateItemStartAngle = item.rotation;

    // Get center of the item element
    const el = document.querySelector(`[data-overlay-id="${id}"]`) as HTMLElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      rotateCenterX = rect.left + rect.width / 2;
      rotateCenterY = rect.top + rect.height / 2;
    }
    rotateStartAngle = Math.atan2(e.clientY - rotateCenterY, e.clientX - rotateCenterX) * (180 / Math.PI);

    window.addEventListener('pointermove', onRotateMove);
    window.addEventListener('pointerup', onRotateEnd);
  }

  function onRotateMove(e: PointerEvent) {
    if (!rotating || !selectedId) return;
    const angle = Math.atan2(e.clientY - rotateCenterY, e.clientX - rotateCenterX) * (180 / Math.PI);
    const delta = angle - rotateStartAngle;
    updateItem(selectedId, { rotation: Math.round(rotateItemStartAngle + delta) });
  }

  function onRotateEnd() {
    rotating = false;
    window.removeEventListener('pointermove', onRotateMove);
    window.removeEventListener('pointerup', onRotateEnd);
  }
</script>

<div class="overlay-container">
  {#each items.filter(i => i.src) as item (item.id)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="overlay-item"
      class:selected={selectedId === item.id}
      data-overlay-id={item.id}
      style="
        left: {item.x}mm;
        top: {item.y}mm;
        width: {item.width}mm;
        height: {item.height}mm;
        transform: rotate({item.rotation}deg);
        opacity: {item.opacity};
        {item.grayscale ? 'filter: grayscale(100%);' : ''}
      "
      onpointerdown={(e) => startDrag(item.id, e)}
      onclick={(e) => selectItem(item.id, e)}
    >
      <img src={item.src} alt={item.id} draggable="false" />

      {#if selectedId === item.id}
        <!-- Resize handle (bottom-right corner) -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="overlay-handle resize-handle" onpointerdown={(e) => startResize(item.id, e)}></div>

        <!-- Rotate handle (top center, above the element) -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="overlay-handle rotate-handle" onpointerdown={(e) => startRotate(item.id, e)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
          </svg>
        </div>

        <!-- Info label -->
        <div class="overlay-label">
          {item.id === 'stamp' ? 'ตราประทับ' : 'ลายเซ็น'} · {item.rotation}°
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .overlay-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 60;
  }

  .overlay-item {
    position: absolute;
    pointer-events: auto;
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    transition: box-shadow 0.1s;
  }

  .overlay-item:active {
    cursor: grabbing;
  }

  .overlay-item img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .overlay-item.selected {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
  }

  .overlay-handle {
    position: absolute;
    pointer-events: auto;
    z-index: 10;
  }

  .resize-handle {
    bottom: -6px;
    right: -6px;
    width: 14px;
    height: 14px;
    background: #3b82f6;
    border: 2px solid #fff;
    border-radius: 2px;
    cursor: nwse-resize;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }

  .rotate-handle {
    top: -28px;
    left: 50%;
    transform: translateX(-50%);
    width: 22px;
    height: 22px;
    background: #fff;
    border: 2px solid #3b82f6;
    border-radius: 50%;
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }

  .rotate-handle:active {
    cursor: grabbing;
    background: #eff6ff;
  }

  .overlay-label {
    position: absolute;
    bottom: -22px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(59, 130, 246, 0.9);
    color: #fff;
    font-size: 9px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
    font-family: 'Sarabun', sans-serif;
  }
</style>
