<script lang="ts">
  import { toasts, removeToast } from '$lib/stores/app';
  import { goto } from '$app/navigation';
  import { X, CheckCircle, AlertCircle, Info, AlertTriangle, ArrowRight } from 'lucide-svelte';

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle
  };

  const colors = {
    success: '#16a34a',
    error: '#dc2626',
    info: '#2563eb',
    warning: '#f59e0b'
  };

  function handleAction(toastId: string, href: string) {
    removeToast(toastId);
    goto(href);
  }
</script>

{#if $toasts.length > 0}
  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div class="toast" style="border-left: 3px solid {colors[toast.type]}">
        <div style="display: flex; align-items: center; gap: 10px;">
          <svelte:component this={icons[toast.type]} size={18} color={colors[toast.type]} />
          <span style="flex: 1;">{toast.message}</span>
          {#if toast.action}
            <button
              class="toast-action"
              style="color: {colors[toast.type]};"
              onclick={() => handleAction(toast.id, toast.action!.href)}
            >
              {toast.action.label} <ArrowRight size={12} />
            </button>
          {/if}
          <button
            class="btn btn-icon"
            style="padding: 4px; background: none; border: none; color: var(--color-gray-400);"
            onclick={() => removeToast(toast.id)}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    background: color-mix(in srgb, currentColor 8%, white);
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    transition: background 0.15s;
  }
  .toast-action:hover {
    background: color-mix(in srgb, currentColor 15%, white);
  }
</style>
