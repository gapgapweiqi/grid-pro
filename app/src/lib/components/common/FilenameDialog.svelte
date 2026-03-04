<script lang="ts">
  import { X, FileDown } from 'lucide-svelte';

  let {
    open = false,
    defaultFilename = 'document.pdf',
    onconfirm = (_filename: string) => {},
    oncancel = () => {},
  }: {
    open?: boolean;
    defaultFilename?: string;
    onconfirm?: (filename: string) => void;
    oncancel?: () => void;
  } = $props();

  let inputValue = $state('');

  $effect(() => {
    if (open) {
      // Strip .pdf extension for editing
      inputValue = defaultFilename.replace(/\.pdf$/i, '');
    }
  });

  function handleConfirm() {
    const name = inputValue.trim() || 'document';
    const finalName = name.endsWith('.pdf') ? name : name + '.pdf';
    onconfirm(finalName);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      oncancel();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fn-overlay" onclick={oncancel} role="dialog" aria-modal="true">
    <div class="fn-modal" onclick={(e) => e.stopPropagation()}>
      <div class="fn-header">
        <h3>ตั้งชื่อไฟล์ PDF</h3>
        <button class="close-btn" onclick={oncancel}>
          <X size={20} />
        </button>
      </div>
      <div class="fn-body">
        <div class="fn-icon-row">
          <div class="fn-icon">
            <FileDown size={28} />
          </div>
        </div>
        <div class="fn-input-group">
          <label class="fn-label" for="pdf-filename-input">ชื่อไฟล์</label>
          <div class="fn-input-wrap">
            <input
              id="pdf-filename-input"
              type="text"
              class="fn-input"
              bind:value={inputValue}
              onkeydown={handleKeydown}
              placeholder="ชื่อไฟล์เอกสาร"
              autofocus
            />
            <span class="fn-ext">.pdf</span>
          </div>
        </div>
      </div>
      <div class="fn-footer">
        <button class="fn-btn cancel" onclick={oncancel}>ยกเลิก</button>
        <button class="fn-btn confirm" onclick={handleConfirm}>
          <FileDown size={16} />
          ดาวน์โหลด
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .fn-overlay {
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
  .fn-modal {
    background: #ffffff;
    width: 100%;
    max-width: 420px;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    animation: fnFadeIn 0.2s ease-out;
  }
  .fn-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .fn-header h3 {
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
  .fn-body {
    margin-bottom: 24px;
  }
  .fn-icon-row {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }
  .fn-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--color-primary, #0ea5e9) 12%, white);
    color: var(--color-primary, #0ea5e9);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fn-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fn-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-gray-700, #374151);
  }
  .fn-input-wrap {
    display: flex;
    align-items: center;
    border: 2px solid var(--color-gray-200, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .fn-input-wrap:focus-within {
    border-color: var(--color-primary, #0ea5e9);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #0ea5e9) 12%, transparent);
  }
  .fn-input {
    flex: 1;
    border: none;
    outline: none;
    padding: 12px 14px;
    font-size: 15px;
    font-family: inherit;
    color: var(--color-gray-900, #111827);
    background: transparent;
    min-width: 0;
  }
  .fn-input::placeholder {
    color: var(--color-gray-400, #9ca3af);
  }
  .fn-ext {
    padding: 12px 14px;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-gray-400, #9ca3af);
    background: var(--color-gray-50, #f9fafb);
    border-left: 1px solid var(--color-gray-200, #e5e7eb);
    white-space: nowrap;
  }
  .fn-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
  .fn-btn {
    padding: 10px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
  }
  .fn-btn.cancel {
    background: var(--color-gray-100, #f3f4f6);
    color: var(--color-gray-600, #4b5563);
  }
  .fn-btn.cancel:hover {
    background: var(--color-gray-200, #e5e7eb);
  }
  .fn-btn.confirm {
    background: var(--color-primary, #0ea5e9);
    color: #fff;
  }
  .fn-btn.confirm:hover {
    background: color-mix(in srgb, var(--color-primary, #0ea5e9) 85%, black);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
  }

  @keyframes fnFadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
