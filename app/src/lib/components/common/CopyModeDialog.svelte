<script lang="ts">
  import { X, FileText, Copy } from 'lucide-svelte';

  let {
    open = false,
    title = 'เลือกรูปแบบเอกสาร',
    lang = 'th',
    onselect = (_mode: 'original' | 'copy') => {},
    oncancel = () => {},
  }: {
    open?: boolean;
    title?: string;
    lang?: string;
    onselect?: (mode: 'original' | 'copy') => void;
    oncancel?: () => void;
  } = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="copy-overlay" onclick={oncancel} role="dialog" aria-modal="true">
    <div class="copy-modal" onclick={(e) => e.stopPropagation()}>
      <div class="copy-header">
        <h3>{title}</h3>
        <button class="close-btn" onclick={oncancel}>
          <X size={20} />
        </button>
      </div>
      <div class="copy-options">
        <button class="copy-btn original" onclick={() => onselect('original')}>
          <div class="icon-wrap">
            <FileText size={24} />
          </div>
          <div class="text-wrap">
            <div class="label">{lang === 'en' ? 'Original' : 'ต้นฉบับ'}</div>
            <div class="desc">{lang === 'en' ? 'Original document' : 'เอกสารฉบับจริง'}</div>
          </div>
        </button>
        <button class="copy-btn copy" onclick={() => onselect('copy')}>
          <div class="icon-wrap">
            <Copy size={24} />
          </div>
          <div class="text-wrap">
            <div class="label">{lang === 'en' ? 'Copy' : 'สำเนา'}</div>
            <div class="desc">{lang === 'en' ? 'Document copy' : 'สำเนาเอกสาร'}</div>
          </div>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .copy-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    padding: 20px;
  }
  .copy-modal {
    background: #ffffff;
    width: 100%;
    max-width: 400px;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    animation: modalFadeIn 0.2s ease-out;
  }
  .copy-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .copy-header h3 {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-gray-900, #111827);
    margin: 0;
  }
  .close-btn {
    background: var(--color-gray-100, #f3f4f6);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gray-500, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
  }
  .close-btn:hover {
    background: var(--color-gray-200, #e5e7eb);
    color: var(--color-gray-700, #374151);
  }
  .copy-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .copy-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: #ffffff;
    border: 2px solid var(--color-gray-200, #e5e7eb);
    border-radius: 16px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .copy-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  }
  .copy-btn.original:hover {
    border-color: var(--color-primary, #0ea5e9);
    background: color-mix(in srgb, var(--color-primary, #0ea5e9) 4%, white);
  }
  .copy-btn.copy:hover {
    border-color: #f97316;
    background: color-mix(in srgb, #f97316 4%, white);
  }
  .copy-btn.original .icon-wrap {
    background: color-mix(in srgb, var(--color-primary, #0ea5e9) 12%, white);
    color: var(--color-primary, #0ea5e9);
  }
  .copy-btn.copy .icon-wrap {
    background: color-mix(in srgb, #f97316 12%, white);
    color: #f97316;
  }
  .icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .text-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-gray-900, #111827);
  }
  .desc {
    font-size: 13px;
    color: var(--color-gray-500, #6b7280);
  }
  
  @keyframes modalFadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
