<script lang="ts">
  import { X, Send, Paperclip, Loader2 } from 'lucide-svelte';
  import { emailApi } from '$lib/services/api-adapter';
  import { addToast } from '$lib/stores/app';

  let {
    open = false,
    docNo = '',
    customerEmail = '',
    customerName = '',
    pdfBase64 = '',
    pdfFilename = 'document.pdf',
    onclose,
    onsent
  }: {
    open: boolean;
    docNo?: string;
    customerEmail?: string;
    customerName?: string;
    pdfBase64?: string;
    pdfFilename?: string;
    onclose: () => void;
    onsent?: () => void;
  } = $props();

  let to = $state('');
  let cc = $state('');
  let subject = $state('');
  let body = $state('');
  let sending = $state(false);
  let attachPdf = $state(true);

  $effect(() => {
    if (open) {
      to = customerEmail || '';
      cc = '';
      subject = docNo ? `เอกสาร ${docNo}` : 'ส่งเอกสาร';
      body = buildDefaultBody();
      attachPdf = !!pdfBase64;
    }
  });

  function buildDefaultBody(): string {
    const name = customerName || 'ท่าน';
    const lines = [
      `เรียน คุณ${name}`,
      '',
      `ตามที่ท่านได้ติดต่อมา ทางเราขอส่งเอกสาร${docNo ? ` ${docNo}` : ''}มาพร้อมนี้`,
      '',
      'หากมีข้อสงสัยประการใด สามารถติดต่อกลับได้ตลอดเวลา',
      '',
      'ขอแสดงความนับถือ',
    ];
    return lines.join('\n');
  }

  async function handleSend() {
    if (!to.trim()) {
      addToast('กรุณาระบุอีเมลผู้รับ', 'error');
      return;
    }

    sending = true;
    try {
      const htmlBody = body.replace(/\n/g, '<br>');
      const payload: any = {
        to: to.trim(),
        subject,
        htmlBody: `<div style="font-family:'Sarabun',sans-serif;font-size:14px;line-height:1.8;color:#333;">${htmlBody}</div>`,
      };
      if (cc.trim()) payload.cc = cc.trim();
      if (attachPdf && pdfBase64) {
        payload.pdfBase64 = pdfBase64;
        payload.pdfFilename = pdfFilename;
      }

      const res = await emailApi.send(payload);
      if (res.ok) {
        addToast('ส่งอีเมลสำเร็จ', 'success');
        onsent?.();
        onclose();
      } else {
        addToast(res.error?.message || 'ส่งอีเมลไม่สำเร็จ', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      sending = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="email-overlay" onkeydown={handleKeydown}>
    <div class="email-dialog">
      <div class="email-header">
        <h3>ส่งเอกสารทางอีเมล</h3>
        <button type="button" class="email-close" onclick={onclose}><X size={18} /></button>
      </div>

      <div class="email-body">
        <div class="email-field">
          <label>ถึง <span class="required">*</span></label>
          <input type="email" bind:value={to} placeholder="email@example.com" />
        </div>
        <div class="email-field">
          <label>สำเนา (CC)</label>
          <input type="text" bind:value={cc} placeholder="cc@example.com" />
        </div>
        <div class="email-field">
          <label>หัวข้อ</label>
          <input type="text" bind:value={subject} />
        </div>
        <div class="email-field">
          <label>เนื้อหา</label>
          <textarea bind:value={body} rows={8}></textarea>
        </div>

        {#if pdfBase64}
          <div class="email-attach">
            <label class="email-attach-label">
              <input type="checkbox" bind:checked={attachPdf} />
              <Paperclip size={14} />
              <span>แนบ {pdfFilename}</span>
            </label>
          </div>
        {/if}
      </div>

      <div class="email-footer">
        <button type="button" class="email-cancel-btn" onclick={onclose}>ยกเลิก</button>
        <button type="button" class="email-send-btn" onclick={handleSend} disabled={sending || !to.trim()}>
          {#if sending}
            <Loader2 size={16} class="spin" />
            กำลังส่ง...
          {:else}
            <Send size={16} />
            ส่งอีเมล
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .email-overlay {
    position: fixed; inset: 0; z-index: 950;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  }
  .email-dialog {
    background: #fff; border-radius: 12px; width: calc(100vw - 48px); max-width: 540px;
    max-height: calc(100vh - 64px); display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden;
  }
  .email-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px; border-bottom: 1px solid #e5e7eb;
  }
  .email-header h3 { font-size: 15px; font-weight: 700; color: #111827; margin: 0; }
  .email-close {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border: none; background: none; color: #6b7280;
    cursor: pointer; border-radius: 6px; transition: all 0.15s;
  }
  .email-close:hover { background: #f3f4f6; color: #111827; }

  .email-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
  .email-field { margin-bottom: 12px; }
  .email-field label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
  .required { color: #ef4444; }
  .email-field input, .email-field textarea {
    width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
    font-size: 14px; font-family: inherit; outline: none; transition: all 0.15s;
    background: #faf8f4;
  }
  .email-field input:focus, .email-field textarea:focus {
    border-color: #3d8b5e; box-shadow: 0 0 0 3px rgba(61,139,94,0.08); background: #fff;
  }
  .email-field textarea { resize: vertical; min-height: 120px; line-height: 1.6; }

  .email-attach { padding: 8px 0; }
  .email-attach-label {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; color: #374151; cursor: pointer;
  }
  .email-attach-label input[type="checkbox"] { accent-color: #1a4731; }

  .email-footer {
    display: flex; align-items: center; justify-content: flex-end; gap: 8px;
    padding: 12px 20px; border-top: 1px solid #e5e7eb; background: #f9fafb;
  }
  .email-cancel-btn {
    padding: 8px 16px; border: 1px solid #d1d5db; background: #fff; color: #374151;
    font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer;
    font-family: inherit; transition: all 0.15s;
  }
  .email-cancel-btn:hover { background: #f3f4f6; }
  .email-send-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 20px; border: none; background: #1a4731; color: #fff;
    font-size: 13px; font-weight: 600; border-radius: 8px; cursor: pointer;
    font-family: inherit; transition: all 0.15s;
  }
  .email-send-btn:hover:not(:disabled) { background: #153d2a; }
  .email-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 640px) {
    .email-dialog { width: calc(100vw - 16px); max-height: calc(100vh - 16px); border-radius: 8px; }
  }
</style>
