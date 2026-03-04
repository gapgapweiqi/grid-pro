<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import {
    activeTourId, activeTourStep, activeTourConfig,
    globalProgress, isSeamlessTour, isNavigating,
    nextStep, prevStep, skipTour
  } from '$lib/stores/tour';
  import { ChevronRight, ChevronLeft, X } from 'lucide-svelte';

  let tooltipEl: HTMLDivElement | undefined = $state();
  let rect: { top: number; left: number; width: number; height: number } | null = $state(null);
  let tooltipStyle = $state('');
  let arrowClass = $state('');
  let fadeKey = $state(0);

  let isActive = $derived($activeTourId !== null && $activeTourConfig !== null);
  let steps = $derived($activeTourConfig?.steps ?? []);
  let currentStep = $derived(isActive ? steps[$activeTourStep] ?? null : null);
  let stepIndex = $derived($activeTourStep);
  let tourTitle = $derived($activeTourConfig?.title ?? '');
  let progress = $derived($globalProgress);
  let seamless = $derived($isSeamlessTour);
  let navigating = $derived($isNavigating);
  let stepProgress = $derived(steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0);

  function scrollToElement(el: Element) {
    const r = el.getBoundingClientRect();
    const viewH = window.innerHeight;
    if (r.top < 80 || r.bottom > viewH - 80) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function positionTooltip() {
    if (!currentStep || !tooltipEl) return;

    const step = currentStep;
    if (!step.selector) {
      rect = null;
      tooltipStyle = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);';
      arrowClass = '';
      return;
    }

    const el = document.querySelector(step.selector);
    if (!el) {
      rect = null;
      tooltipStyle = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);';
      arrowClass = '';
      return;
    }

    scrollToElement(el);

    // Wait a bit for scroll to finish
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      rect = { top: r.top, left: r.left, width: r.width, height: r.height };

      const pad = 14;
      const pos = step.position || 'bottom';
      const ttW = Math.min(370, window.innerWidth - 32);

      let top = 0;
      let left = 0;

      switch (pos) {
        case 'bottom':
          top = r.bottom + pad;
          left = r.left + r.width / 2 - ttW / 2;
          arrowClass = 'arrow-top';
          break;
        case 'top':
          top = r.top - pad;
          left = r.left + r.width / 2 - ttW / 2;
          arrowClass = 'arrow-bottom';
          break;
        case 'right':
          top = r.top + r.height / 2;
          left = r.right + pad;
          arrowClass = 'arrow-left';
          break;
        case 'left':
          top = r.top + r.height / 2;
          left = r.left - ttW - pad;
          arrowClass = 'arrow-right';
          break;
      }

      left = Math.max(16, Math.min(left, window.innerWidth - ttW - 16));
      top = Math.max(16, Math.min(top, window.innerHeight - 220));

      if (pos === 'top') {
        tooltipStyle = `position:fixed;bottom:${window.innerHeight - top}px;left:${left}px;width:${ttW}px;`;
      } else {
        tooltipStyle = `position:fixed;top:${top}px;left:${left}px;width:${ttW}px;`;
      }
    });
  }

  function handleNext() {
    nextStep(steps.length);
    fadeKey++;
    tick().then(() => setTimeout(positionTooltip, 150));
  }

  function handlePrev() {
    prevStep();
    fadeKey++;
    tick().then(() => setTimeout(positionTooltip, 150));
  }

  function handleSkip() {
    skipTour();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isActive) return;
    if (e.key === 'Escape') handleSkip();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
    else if (e.key === 'ArrowLeft') handlePrev();
  }

  let resizeListener: (() => void) | null = null;

  onMount(() => {
    resizeListener = () => positionTooltip();
    window.addEventListener('resize', resizeListener);
    window.addEventListener('scroll', resizeListener, true);
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    if (resizeListener) {
      window.removeEventListener('resize', resizeListener);
      window.removeEventListener('scroll', resizeListener, true);
    }
    window.removeEventListener('keydown', handleKeydown);
  });

  $effect(() => {
    if (isActive && currentStep) {
      setTimeout(positionTooltip, 250);
    }
  });
</script>

{#if isActive && currentStep && !navigating}
  <!-- Overlay backdrop -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tour-overlay" onclick={handleSkip} onkeydown={() => {}} role="presentation">
    {#if rect}
      <div
        class="tour-highlight"
        style="top:{rect.top - 6}px;left:{rect.left - 6}px;width:{rect.width + 12}px;height:{rect.height + 12}px;"
      ></div>
      <div
        class="tour-pulse"
        style="top:{rect.top - 10}px;left:{rect.left - 10}px;width:{rect.width + 20}px;height:{rect.height + 20}px;"
      ></div>
    {/if}
  </div>

  <!-- Tooltip -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  {#key fadeKey}
  <div class="tour-tooltip {arrowClass}" style={tooltipStyle} bind:this={tooltipEl} onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog" aria-label="Tour step">

    <!-- Progress bar -->
    <div class="tour-progress-track">
      <div class="tour-progress-fill" style="width: {stepProgress}%"></div>
    </div>

    <button class="tour-close" onclick={handleSkip} aria-label="ปิดทัวร์"><X size={15} /></button>

    <!-- Global page progress (seamless mode) -->
    {#if seamless && progress}
      <div class="tour-global-badge">
        หน้า {progress.current}/{progress.total} — {tourTitle}
      </div>
    {/if}

    <div class="tour-header">
      {#if currentStep.emoji}
        <span class="tour-emoji">{currentStep.emoji}</span>
      {/if}
      <h3 class="tour-title">{currentStep.title}</h3>
    </div>

    <p class="tour-desc">{currentStep.desc}</p>

    <div class="tour-footer">
      <div class="tour-dots">
        {#each steps as _, i}
          <span class="tour-dot" class:active={i === stepIndex} class:done={i < stepIndex}></span>
        {/each}
      </div>
      <div class="tour-btns">
        {#if stepIndex > 0}
          <button class="tour-btn tour-btn-ghost" onclick={handlePrev}><ChevronLeft size={14} /> ย้อน</button>
        {:else}
          <button class="tour-btn tour-btn-skip" onclick={handleSkip}>ข้าม</button>
        {/if}
        {#if stepIndex < steps.length - 1}
          <button class="tour-btn tour-btn-primary" onclick={handleNext}>ถัดไป <ChevronRight size={14} /></button>
        {:else if seamless && progress && progress.current < progress.total}
          <button class="tour-btn tour-btn-primary tour-btn-next-page" onclick={handleNext}>หน้าถัดไป <ChevronRight size={14} /></button>
        {:else}
          <button class="tour-btn tour-btn-primary tour-btn-done" onclick={handleNext}>เสร็จสิ้น 🎉</button>
        {/if}
      </div>
    </div>

    <!-- Keyboard hint -->
    <div class="tour-kbd-hint">
      ใช้ <kbd>←</kbd> <kbd>→</kbd> หรือ <kbd>Esc</kbd> เพื่อปิด
    </div>
  </div>
  {/key}
{/if}

<style>
  .tour-overlay {
    position: fixed; inset: 0; z-index: 9998;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    transition: background 0.3s;
  }

  .tour-highlight {
    position: fixed; border-radius: 10px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    background: transparent;
    border: 2px solid rgba(61, 139, 94, 0.9);
    z-index: 9999;
    pointer-events: none;
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tour-pulse {
    position: fixed; border-radius: 12px;
    border: 2px solid rgba(61, 139, 94, 0.4);
    z-index: 9998;
    pointer-events: none;
    animation: tourPulse 2s ease-in-out infinite;
  }

  @keyframes tourPulse {
    0%, 100% { opacity: 0; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.02); }
  }

  .tour-tooltip {
    z-index: 10000;
    background: rgba(255, 255, 255, 0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 16px;
    padding: 0 20px 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.04);
    max-width: 380px;
    animation: tourSlideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  @keyframes tourSlideIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Progress bar at top */
  .tour-progress-track {
    margin: 0 -20px 14px;
    height: 3px;
    background: #f0f0f0;
    border-radius: 0;
  }
  .tour-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3d8b5e, #22c55e);
    border-radius: 0 2px 2px 0;
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Arrows */
  .tour-tooltip.arrow-top::before {
    content: ''; position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
    border-left: 7px solid transparent; border-right: 7px solid transparent;
    border-bottom: 7px solid rgba(255, 255, 255, 0.97);
  }
  .tour-tooltip.arrow-bottom::after {
    content: ''; position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%);
    border-left: 7px solid transparent; border-right: 7px solid transparent;
    border-top: 7px solid rgba(255, 255, 255, 0.97);
  }
  .tour-tooltip.arrow-left::before {
    content: ''; position: absolute; left: -7px; top: 28px;
    border-top: 7px solid transparent; border-bottom: 7px solid transparent;
    border-right: 7px solid rgba(255, 255, 255, 0.97);
  }
  .tour-tooltip.arrow-right::after {
    content: ''; position: absolute; right: -7px; top: 28px;
    border-top: 7px solid transparent; border-bottom: 7px solid transparent;
    border-left: 7px solid rgba(255, 255, 255, 0.97);
  }

  .tour-close {
    position: absolute; top: 16px; right: 12px;
    background: none; border: none; color: #9ca3af; cursor: pointer; padding: 5px;
    border-radius: 8px; transition: all 0.15s; z-index: 1;
  }
  .tour-close:hover { color: #374151; background: rgba(0,0,0,0.06); }

  /* Global badge */
  .tour-global-badge {
    font-size: 10px; font-weight: 700; color: #3d8b5e;
    background: rgba(61, 139, 94, 0.08);
    border: 1px solid rgba(61, 139, 94, 0.15);
    padding: 3px 10px; border-radius: 20px;
    display: inline-block; margin-bottom: 10px;
    letter-spacing: 0.02em;
  }

  .tour-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding-right: 24px; }
  .tour-emoji {
    font-size: 26px; line-height: 1; flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
  }
  .tour-title { font-size: 16px; font-weight: 800; color: #111827; margin: 0; line-height: 1.3; }
  .tour-desc { font-size: 13.5px; color: #6b7280; line-height: 1.7; margin: 0 0 14px; }

  .tour-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

  /* Step dots */
  .tour-dots { display: flex; gap: 5px; align-items: center; }
  .tour-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #ddd; transition: all 0.3s;
  }
  .tour-dot.active {
    width: 18px; border-radius: 4px;
    background: linear-gradient(90deg, #3d8b5e, #22c55e);
  }
  .tour-dot.done { background: #3d8b5e; }

  .tour-btns { display: flex; gap: 6px; }

  .tour-btn {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 7px 13px; border-radius: 9px; font-size: 12.5px; font-weight: 700;
    cursor: pointer; border: none; font-family: inherit; transition: all 0.2s;
    white-space: nowrap;
  }
  .tour-btn-primary {
    background: linear-gradient(135deg, #1a4731, #3d8b5e);
    color: #fff;
    box-shadow: 0 2px 8px rgba(26, 71, 49, 0.3);
  }
  .tour-btn-primary:hover { box-shadow: 0 4px 14px rgba(26, 71, 49, 0.4); transform: translateY(-1px); }
  .tour-btn-next-page {
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
  }
  .tour-btn-next-page:hover { box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
  .tour-btn-done {
    background: linear-gradient(135deg, #059669, #10b981);
    box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
  }
  .tour-btn-done:hover { box-shadow: 0 4px 14px rgba(5, 150, 105, 0.4); }
  .tour-btn-ghost { background: #f3f4f6; color: #374151; }
  .tour-btn-ghost:hover { background: #e5e7eb; }
  .tour-btn-skip { background: none; color: #9ca3af; padding: 7px 8px; }
  .tour-btn-skip:hover { color: #6b7280; background: rgba(0,0,0,0.04); }

  /* Keyboard hint */
  .tour-kbd-hint {
    margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05);
    font-size: 10px; color: #b0b0b0; text-align: center;
  }
  .tour-kbd-hint kbd {
    display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 9px;
    background: #f3f4f6; border: 1px solid #e5e7eb; color: #9ca3af;
    font-family: inherit; margin: 0 1px;
  }

  @media (max-width: 640px) {
    .tour-tooltip { max-width: calc(100vw - 24px); }
    .tour-kbd-hint { display: none; }
    .tour-dots { display: none; }
  }
</style>
