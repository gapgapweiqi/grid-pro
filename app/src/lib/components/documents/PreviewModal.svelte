<script lang="ts">
  import { onMount } from 'svelte';
  import { X, Printer, FileText, ZoomIn, ZoomOut, Maximize, Loader2, Mail } from 'lucide-svelte';
  import type { Snippet } from 'svelte';
  import type { OverlayItem } from '$lib/types';
  import CopyModeDialog from '$lib/components/common/CopyModeDialog.svelte';
  import FilenameDialog from '$lib/components/common/FilenameDialog.svelte';
  import InteractiveOverlay from './InteractiveOverlay.svelte';
  import EmailComposeDialog from './EmailComposeDialog.svelte';
  import { printHtmlContent } from '$lib/utils/print';

  let {
    open = false,
    title = 'พรีวิวเอกสาร',
    filename = 'document.pdf',
    docNo = '',
    docType = '',
    customerEmail = '',
    customerName = '',
    lang = 'th',
    overlayItems = [],
    autoAction = null,
    autoActionMode = null,
    onoverlaychange,
    onclose,
    onprint,
    onautoactiondone,
    ondownloadcomplete,
    children
  }: {
    open: boolean;
    title?: string;
    filename?: string;
    docNo?: string;
    docType?: string;
    customerEmail?: string;
    customerName?: string;
    lang?: string;
    overlayItems?: OverlayItem[];
    autoAction?: 'print' | 'download' | null;
    autoActionMode?: 'original' | 'copy' | null;
    onoverlaychange?: (items: OverlayItem[]) => void;
    onclose: () => void;
    onprint?: (mode: 'original' | 'copy') => void;
    onautoactiondone?: () => void;
    ondownloadcomplete?: () => void;
    children: Snippet;
  } = $props();

  // Copy badge always shows "สำเนา" / "Copy" for all doc types
  let copyBadgeText = $derived(lang === 'en' ? 'Copy' : 'สำเนา');

  let showCopyMode = $state(false);
  let copyModeAction: 'print' | 'pdf' | 'email' = $state('print');
  let pdfBusy = $state(false);
  let showFilenameDialog = $state(false);
  let pendingPdfMode: 'original' | 'copy' = $state('original');
  let showEmailDialog = $state(false);
  let emailPdfBase64 = $state('');

  let zoomLevel = $state(100);
  let previewBody: HTMLDivElement | undefined = $state();

  onMount(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      zoomLevel = 66;
    }
  });

  function zoomIn() {
    zoomLevel = Math.min(200, zoomLevel + 10);
  }

  function zoomOut() {
    zoomLevel = Math.max(40, zoomLevel - 10);
  }

  function zoomFit() {
    if (!previewBody) { zoomLevel = 100; return; }
    const containerW = previewBody.clientWidth - 48;
    const a4W = 794;
    zoomLevel = Math.round((containerW / a4W) * 100);
  }

  function openPrintCopyMode() {
    copyModeAction = 'print';
    showCopyMode = true;
  }

  function openPdfCopyMode() {
    copyModeAction = 'pdf';
    showCopyMode = true;
  }

  function handleCopyModeSelect(mode: 'original' | 'copy') {
    showCopyMode = false;
    if (copyModeAction === 'print') {
      if (onprint) { onprint(mode); return; }
      doPrint(mode);
    } else if (copyModeAction === 'email') {
      generatePdfBase64ForEmail(mode);
    } else {
      pendingPdfMode = mode;
      showFilenameDialog = true;
    }
  }

  function openEmailCopyMode() {
    copyModeAction = 'email';
    showCopyMode = true;
  }

  async function generatePdfBase64ForEmail(mode: 'original' | 'copy') {
    pdfBusy = true;
    try {
      const result = await buildPdfClone(mode);
      if (!result) throw new Error('Cannot build PDF clone');
      document.body.appendChild(result.container);
      await new Promise(r => setTimeout(r, 300));
      const { default: html2pdf } = await import('html2pdf.js');
      const opt: any = {
        margin: 0,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, width: 794, windowWidth: 794, scrollX: 0, scrollY: 0, x: 0, y: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all'] }
      };
      await html2pdf().set(opt).from(result.clone).toPdf().get('pdf').then((pdf: any) => {
        while (pdf.internal.getNumberOfPages() > result.pageCount) {
          pdf.deletePage(pdf.internal.getNumberOfPages());
        }
        const base64 = pdf.output('datauristring').split(',')[1];
        emailPdfBase64 = base64;
      });
      document.body.removeChild(result.container);
      document.getElementById('__pdf-clone-styles__')?.remove();
      showEmailDialog = true;
    } catch (err) {
      console.error('PDF generation for email error:', err);
      const staleContainer = document.querySelector('[style*="z-index:-9999"]');
      if (staleContainer) staleContainer.remove();
      document.getElementById('__pdf-clone-styles__')?.remove();
      emailPdfBase64 = '';
      showEmailDialog = true;
    } finally {
      pdfBusy = false;
    }
  }

  function handleFilenameConfirm(chosenFilename: string) {
    showFilenameDialog = false;
    doDownloadPdf(pendingPdfMode, chosenFilename);
  }

  /** Extract doc-related CSS from stylesheets (targeted, not all app styles) */
  function getDocPrintStyles(): string {
    let css = '';
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            const text = rule.cssText;
            if (text.includes('.doc-') || text.includes('.doc_') ||
                text.includes('.center') || text.includes('.right') ||
                text.includes('.a4-') || text.includes('@page') ||
                text.includes('doc-preview') || text.includes('doc-page') ||
                text.includes('doc-badge') || text.includes('doc-carry') ||
                text.includes('layout-') || text.includes('table-') ||
                text.includes('color-') || text.includes('header-') ||
                text.includes('with-border')) {
              css += text + '\n';
            }
          }
        } catch { /* cross-origin stylesheet, skip */ }
      }
    } catch { /* fallback */ }
    return css;
  }

  /**
   * Clone print target and swap badges — matches GAS prepareDocNode exactly.
   * Original: blue bg pill. Copy: default gray pill (from CSS).
   */
  function preparePrintNode(mode: 'original' | 'copy'): HTMLElement | null {
    if (!previewBody) return null;
    const printTarget = previewBody.querySelector('#docPreviewPrint') || previewBody.querySelector('.paginated-doc') || previewBody.querySelector('.doc-preview');
    if (!printTarget) return null;

    const clone = printTarget.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'top left';

    // Update all .doc-badge elements (matches GAS prepareDocNode)
    const badges = clone.querySelectorAll('.doc-badge');
    badges.forEach(badge => {
      if (mode === 'original') {
        badge.innerHTML = `<span style="background:#dbeafe;color:#1e40af;">${lang === 'en' ? 'Original' : 'ต้นฉบับ'}</span>`;
      } else {
        badge.innerHTML = `<span>${copyBadgeText}</span>`;
      }
    });

    // Reset preview-stage transforms
    const stages = clone.querySelectorAll('.preview-stage');
    stages.forEach(s => { (s as HTMLElement).style.transform = 'none'; });

    // Hide measure container
    const measureEl = clone.querySelector('.measure-container');
    if (measureEl) (measureEl as HTMLElement).style.display = 'none';

    return clone;
  }

  /** Convert an image src to grayscale via canvas (html2canvas ignores CSS filter:grayscale) */
  function convertImageToGrayscale(src: string): Promise<string> {
    return new Promise((resolve) => {
      if (!src) { resolve(src); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;

          // Try CSS filter first (fast, but unsupported on Safari < 16)
          const supportsFilter = typeof ctx.filter !== 'undefined';
          if (supportsFilter) {
            ctx.filter = 'grayscale(100%)';
          }
          ctx.drawImage(img, 0, 0, w, h);

          // Fallback: manual pixel manipulation if filter not supported
          if (!supportsFilter) {
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              data[i] = gray;
              data[i + 1] = gray;
              data[i + 2] = gray;
            }
            ctx.putImageData(imageData, 0, 0);
          }

          resolve(canvas.toDataURL('image/png'));
        } catch { resolve(src); }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  /** Build overlay HTML to inject into print clones (async to pre-convert grayscale) */
  async function buildOverlayHtml(items: OverlayItem[]): Promise<string> {
    const parts: string[] = [];
    for (const item of items.filter(i => i.src)) {
      const src = item.grayscale ? await convertImageToGrayscale(item.src) : item.src;
      const style = [
        'position:absolute',
        `left:${item.x}mm`,
        `top:${item.y}mm`,
        `width:${item.width}mm`,
        `height:${item.height}mm`,
        `transform:rotate(${item.rotation}deg)`,
        `opacity:${item.opacity}`,
        'z-index:50',
        'pointer-events:none',
        'overflow:hidden',
        'display:flex',
        'align-items:center',
        'justify-content:center'
      ].join(';');
      parts.push(`<div style="${style}"><img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`);
    }
    return parts.join('');
  }

  /** Build overlay HTML synchronously (for print, keeps CSS filter) */
  function buildOverlayHtmlSync(items: OverlayItem[]): string {
    return items.filter(i => i.src).map(item => {
      const style = [
        'position:absolute',
        `left:${item.x}mm`,
        `top:${item.y}mm`,
        `width:${item.width}mm`,
        `height:${item.height}mm`,
        `transform:rotate(${item.rotation}deg)`,
        `opacity:${item.opacity}`,
        item.grayscale ? 'filter:grayscale(100%)' : '',
        'z-index:50',
        'pointer-events:none',
        'overflow:hidden',
        'display:flex',
        'align-items:center',
        'justify-content:center'
      ].filter(Boolean).join(';');
      return `<div style="${style}"><img src="${item.src}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`;
    }).join('');
  }

  function doPrint(mode: 'original' | 'copy') {
    const printNode = preparePrintNode(mode);
    if (!printNode) return;

    // Inject overlay items into each doc-preview page (sync for print)
    const overlayHtml = buildOverlayHtmlSync(overlayItems);
    if (overlayHtml) {
      const pages = printNode.querySelectorAll('.doc-preview');
      if (pages.length > 0) {
        pages.forEach(page => { page.insertAdjacentHTML('beforeend', overlayHtml); });
      } else {
        printNode.insertAdjacentHTML('beforeend', overlayHtml);
      }
    }

    const docStyles = getDocPrintStyles();
    const printCss = [
      '@page { size: A4; margin: 0; }',
      '* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; box-sizing: border-box; }',
      "body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; background: #fff; color: #111827; }",
      ".doc-preview { font-family: 'Sarabun', sans-serif; font-size: 12px; color: #111827; line-height: 1.5; padding: 14mm 16mm; box-sizing: border-box; position: relative; overflow: hidden; width: 210mm; height: 297mm; background: #fff; page-break-after: always; }",
      '.doc-preview:last-child { page-break-after: auto; }',
      '.doc-preview.doc-page { height: 297mm; page-break-after: always; overflow: hidden; }',
      '.doc-preview.doc-page:last-child { page-break-after: auto; }',
      '.doc-badge { text-align: right; margin-bottom: 8px; }',
      '.doc-badge span { background: #f3f4f6; color: #6b7280; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 500; display: inline-block; }',
      '.doc-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); width: 280px; height: 280px; z-index: 50; pointer-events: none; display: flex; align-items: center; justify-content: center; }',
      '.doc-watermark img { max-width: 100%; max-height: 100%; object-fit: contain; opacity: 0.15; filter: grayscale(100%); }',
      '.doc-carry-forward td { font-size: 11px; color: #374151; font-weight: 600; }',
      '.doc-empty-row td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; }',
      '.doc-preview .center { text-align: center; }',
      '.doc-preview .right { text-align: right; }',
      '.doc-preview { box-shadow: none; }',
      '.paginated-doc { width: 210mm; }',
      '.doc-page-wrapper { width: 210mm; margin-bottom: 0; }',
      '.measure-container { display: none !important; }',
      '.overlay-handle, .overlay-rotate-handle { display: none !important; }',
      docStyles,
    ].join('\n');

    printHtmlContent({
      title,
      css: printCss,
      bodyHtml: printNode.outerHTML,
    });
  }

  /**
   * Build CSS color overrides that hardcode all accent colors.
   * html2canvas CANNOT resolve CSS custom properties (var(--doc-accent)),
   * so we must inject real hex values via !important.
   * (Matches GAS _buildPdfColorOverrides in js_preview.html:1183-1191)
   */
  function buildPdfColorOverrides(accent: string, soft: string): string {
    return `
      .doc-company-name, .doc-title-th, .doc-note-title,
      .doc-payment-title, .doc-terms-title, .doc-signature-title,
      .doc-meta-table .doc-meta-label, .doc-bank-section-title {
        color: ${accent} !important;
      }
      .doc-section-title {
        background: ${soft} !important;
        color: ${accent} !important;
      }
      .doc-totals-table .total {
        background: ${soft} !important;
        color: ${accent} !important;
      }
      .doc-totals-table .total td,
      .doc-totals-table .total .value {
        color: ${accent} !important;
      }
      .doc-amount-words, .doc-amount-words-bar {
        background: ${soft} !important;
        border-color: ${accent} !important;
        color: ${accent} !important;
      }
      .doc-bank-icon { background: ${accent} !important; }
      /* Classic template overrides */
      .layout-classic .doc-section-title {
        background: ${accent} !important;
        color: #fff !important;
      }
      .layout-classic .doc-totals-table .total {
        background: ${accent} !important;
      }
      .layout-classic .doc-totals-table .total td,
      .layout-classic .doc-totals-table .total .value {
        color: #fff !important;
      }
      .layout-classic .doc-amount-words-bar {
        background: ${accent} !important;
        color: #fff !important;
        border-color: ${accent} !important;
      }
    `;
  }

  /**
   * Complete self-contained CSS for the PDF shadow clone.
   * NO CSS variables, NO Svelte scoped selectors — just plain classes with hardcoded values.
   * Based on GAS getDocPrintStyles() (js_state.html:17-124) + DocPreview.svelte styles.
   */
  function getFullDocStyles(accent: string, soft: string): string {
    return `
      @page { size: A4; margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; margin: 0; padding: 0; color: #111827; background: #fff; }

      /* A4 page container */
      .doc-preview {
        font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
        font-size: 12px; color: #111827; line-height: 1.5;
        padding: 14mm 16mm; box-sizing: border-box;
        position: relative; overflow: hidden;
        width: 210mm; min-height: 297mm; background: #fff;
        box-shadow: none;
      }
      .doc-preview.doc-page { height: 297mm; overflow: hidden; }

      /* Badge */
      .doc-badge { text-align: right; margin-bottom: 8px; }
      .doc-badge span {
        background: #f3f4f6; color: #6b7280;
        padding-top: 0px; padding-right: 12px; padding-bottom: 10px; padding-left: 12px;
        border-radius: 4px;
        font-size: 11px; font-weight: 500; display: inline-block;
        text-align: center; line-height: 1.0;
      }

      /* Header */
      .doc-header {
        display: flex; justify-content: space-between; align-items: flex-start;
        gap: 20px; margin-bottom: 12px; flex-wrap: wrap;
      }
      .doc-brand { display: flex; gap: 16px; align-items: flex-start; min-width: 0; flex: 1 1 320px; }
      .doc-logo {
        width: 80px; height: 80px; background: #f3f4f6; border-radius: 8px;
        display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
      }
      .doc-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
      .doc-logo-fallback { font-size: 32px; }
      .doc-company { flex: 1; min-width: 0; }
      .doc-company-name {
        font-size: 20px; font-weight: 700; color: ${accent};
        margin-bottom: 4px; overflow-wrap: anywhere;
      }
      .doc-company-meta { font-size: 11px; color: #6b7280; line-height: 1.6; overflow-wrap: anywhere; word-break: break-word; }
      .doc-title { text-align: right; min-width: 0; flex: 0 1 220px; }
      .doc-title-th { font-size: 28px; font-weight: 700; color: ${accent}; overflow-wrap: anywhere; }
      .doc-title-en { font-size: 14px; color: #9ca3af; margin-top: 2px; }

      /* Parties */
      .doc-parties { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
      .doc-customer-info { flex: 1; min-width: 0; }
      .doc-ci-header { font-size: 11px; color: #6b7280; font-weight: 600; text-decoration: underline; margin-bottom: 2px; margin-top: 4px; }
      .doc-ci-name { font-size: 12px; color: #111827; font-weight: 600; line-height: 1.5; }
      .doc-ci-detail { font-size: 11px; color: #374151; line-height: 1.5; word-break: break-word; }
      .doc-ci-custom-fields { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 4px; font-size: 11px; color: #374151; }
      .doc-ci-custom-item { white-space: nowrap; }
      .doc-meta { flex-shrink: 0; }
      .doc-meta-table { border-collapse: collapse; font-size: 11px; }
      .doc-meta-table td { padding-top: 0px; padding-bottom: 5px; padding-left: 0; padding-right: 0; }
      .doc-meta-table .doc-meta-label { color: ${accent}; font-weight: 600; padding-right: 12px; white-space: nowrap; font-size: 11px; }
      .doc-meta-table .doc-meta-value { font-weight: 600; color: #111827; min-width: 120px; font-size: 11px; padding-left: 8px; }

      /* Section Title */
      .doc-section-title {
        background: ${soft}; color: ${accent};
        padding-top: 4px; padding-right: 12px; padding-bottom: 14px; padding-left: 12px;
        font-weight: 600; font-size: 12px;
        border: 1px solid #e5e7eb; border-bottom: none;
        display: flex; align-items: center; line-height: 1.1;
      }

      /* Items Table */
      .doc-items-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-top: none; table-layout: fixed; }
      .doc-items-table thead th {
        background: #f9fafb; border-bottom: 2px solid #e5e7eb;
        font-size: 11px; color: #374151; font-weight: 600;
        padding-top: 1px; padding-bottom: 12px; padding-left: 8px; padding-right: 8px;
        vertical-align: middle; text-align: center; line-height: 1.1;
      }
      .doc-items-table tbody td {
        padding-top: 0px; padding-bottom: 12px; padding-left: 6px; padding-right: 6px;
        font-size: 11px; line-height: 1.3;
        border-bottom: 1px solid #e5e7eb; vertical-align: middle;
        overflow-wrap: anywhere; word-break: break-word;
      }
      .doc-item-code { font-size: 10px; color: #6b7280; padding-top: 0px !important; padding-bottom: 12px !important; }
      .doc-item-name { font-weight: 500; line-height: 1.4; font-size: 11px; overflow-wrap: anywhere; padding-top: 0px !important; padding-bottom: 12px !important; }
      .doc-item-desc { font-size: 10px; line-height: 1.4; color: #6b7280; padding-top: 2px; padding-bottom: 0px; }
      .doc-item-total { font-weight: 600; }
      .doc-items-empty { padding: 40px; text-align: center !important; color: #9ca3af; vertical-align: middle !important; }
      .doc-detail-row td { padding-top: 0px !important; padding-bottom: 12px !important; padding-left: 6px !important; padding-right: 6px !important; border-bottom: none !important; }
      .doc-detail-text { font-size: 0.85em; color: #6b7280; text-align: left; padding-left: 0 !important; padding-top: 0px !important; padding-bottom: 12px !important; }
      .center { text-align: center !important; vertical-align: middle !important; }
      .right { text-align: right !important; vertical-align: middle !important; }

      /* Carry-forward rows */
      .doc-carry-forward-row td { border-bottom: none !important; }
      .doc-brought-forward-cell { text-align: right !important; font-weight: 600; padding: 2px 8px 10px 8px !important; font-size: 11px; color: #374151; border-bottom: 1px solid #d1d5db !important; vertical-align: middle !important; }
      .doc-empty-row td { padding: 4px 6px !important; border-bottom: 1px solid #f3f4f6 !important; height: 20px; }

      /* Watermark/Stamp */
      .doc-watermark {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%) rotate(-35deg);
        width: 280px; height: 280px; z-index: 50;
        pointer-events: none; display: flex; align-items: center; justify-content: center;
      }
      .doc-watermark img { max-width: 100%; max-height: 100%; object-fit: contain; opacity: 0.15; filter: grayscale(100%); }

      /* Summary */
      .doc-summary { display: flex; gap: 16px; margin-top: 8px; align-items: flex-start; flex-wrap: wrap; }
      .doc-summary-left { flex: 1; min-width: 0; }
      .doc-totals { width: 240px; flex-shrink: 0; }
      .doc-totals-table { width: 100%; font-size: 12px; border-collapse: collapse; }
      .doc-totals-table td { padding-top: 2px; padding-bottom: 10px; padding-left: 0; padding-right: 0; color: #6b7280; vertical-align: middle; line-height: 1.1; }
      .doc-totals-table .value { text-align: right; font-weight: 500; color: #111827; vertical-align: middle; }
      .doc-totals-table .total { background: ${soft}; color: ${accent}; }
      .doc-totals-table .total td { padding-top: 2px; padding-bottom: 12px; padding-left: 6px; padding-right: 6px; font-weight: 600; vertical-align: middle; line-height: 1.1; }
      .doc-totals-table .total .value { font-weight: 700; font-size: 14px; color: ${accent}; vertical-align: middle; }

      /* Amount Words Bar */
      .doc-amount-words-bar {
        width: 100%; background: ${soft}; border: 1px solid ${accent};
        border-radius: 4px; padding-top: 2px; padding-right: 12px; padding-bottom: 12px; padding-left: 12px;
        text-align: center !important;
        font-size: 11px; font-weight: 500; color: ${accent};
        margin-top: 8px; margin-bottom: 8px; box-sizing: border-box;
        display: flex; align-items: center; justify-content: center; line-height: 1.1;
      }

      /* Payment Terms */
      .doc-payment-terms-line { font-size: 11px; color: #374151; margin-bottom: 4px; }
      .doc-pm-line { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 0; }
      .doc-pm-item { display: inline-flex; align-items: center; margin-left: 10px; white-space: nowrap; font-size: 11px; }

      /* Terms */
      .doc-terms { margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; }
      .doc-terms-title { background: #f9fafb; padding-top: 2px; padding-right: 12px; padding-bottom: 10px; padding-left: 12px; font-weight: 600; font-size: 11px; border-bottom: 1px solid #e5e7eb; color: ${accent}; }
      .doc-terms-body { padding-top: 2px; padding-right: 12px; padding-bottom: 12px; padding-left: 12px; font-size: 11px; color: #374151; line-height: 1.5; }

      /* Bank */
      .doc-bank-section { margin-top: 8px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
      .doc-bank-section-title { background: #f9fafb; color: ${accent}; padding-top: 2px; padding-right: 12px; padding-bottom: 10px; padding-left: 12px; font-weight: 600; font-size: 11px; border-bottom: 1px solid #e5e7eb; }
      .doc-bank-section-full { margin-top: 8px; width: 100%; }
      .doc-bank-section .doc-bank-info { margin-top: 0; padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
      .doc-bank-section .doc-bank-info:last-child { border-bottom: none; }
      .doc-bank-info { display: flex; align-items: center; justify-content: flex-start; gap: 16px; margin-top: 8px; }
      .doc-bank-details { font-size: 11px; line-height: 1.5; color: #111827; }
      .doc-bank-qr { width: 60px; height: 60px; flex-shrink: 0; padding: 2px; background: #fff; border: 1px solid #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
      .doc-bank-qr img { width: 100%; height: 100%; object-fit: contain; }

      /* Signature */
      .doc-signature { display: flex; justify-content: space-between; gap: 16px; margin-top: 16px; padding-top: 8px; }
      .doc-signature-block { text-align: center; width: 160px; }
      .doc-signature-title { font-size: 11px; font-weight: 600; color: ${accent}; margin-bottom: 12px; padding-top: 0px; padding-bottom: 5px; }
      .doc-signature-line { border-top: 1px solid #d1d5db; padding-top: 4px; }
      .doc-signature-name { font-size: 11px; color: #6b7280; }
      .doc-signature-date { font-size: 10px; color: #9ca3af; margin-top: 4px; }
      .doc-signature-image { display: flex; justify-content: center; align-items: flex-end; min-height: 50px; }
      .doc-signature-image img { max-height: 50px; max-width: 150px; object-fit: contain; }

      /* Notes Footer */
      .doc-note-footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; line-height: 1.6; }

      /* Pagination */
      .paginated-doc { width: 210mm; }
      .doc-page-wrapper { width: 210mm; margin-bottom: 0; }
      .measure-container { display: none !important; }

      /* Overlay items (baked in for PDF) */
      .overlay-container { pointer-events: none; }
      .overlay-handle, .overlay-label { display: none !important; }
      .overlay-item { pointer-events: none; }
      .overlay-item.selected { outline: none !important; box-shadow: none !important; }

      /* ===== Template Layout Variants ===== */
      .doc-preview.layout-modern { padding-top: 0; }
      .doc-preview.layout-modern::before {
        content: ''; display: block; height: 8px; background: ${accent};
        margin: 0 -16mm; margin-top: 0; margin-bottom: 14mm; width: calc(100% + 32mm);
      }
      .doc-preview.layout-modern .doc-title-th { font-size: 32px; }
      .doc-preview.layout-modern .doc-company-name { font-size: 22px; }

      .doc-preview.color-minimal { }
      .doc-preview.color-minimal .doc-section-title { background: transparent !important; border: none; border-bottom: 1px solid #d1d5db; color: #6b7280 !important; }
      .doc-preview.color-minimal .doc-amount-words-bar { border-color: #d1d5db !important; background: #f9fafb !important; color: #374151 !important; }
      .doc-preview.color-minimal .doc-totals-table .total { background: #f9fafb !important; }
      .doc-preview.color-minimal .doc-totals-table .total td { color: #374151 !important; }
      .doc-preview.color-minimal .doc-totals-table .total .value { color: #111827 !important; }
      .doc-preview.color-minimal .doc-title-th { font-size: 24px; }
      .doc-preview.color-minimal .doc-company-name { color: #6b7280 !important; }
      .doc-preview.color-minimal .doc-title-th { color: #6b7280 !important; }
      .doc-preview.color-minimal .doc-meta-table .doc-meta-label { color: #6b7280 !important; }
      .doc-preview.color-minimal .doc-terms-title { color: #6b7280 !important; }
      .doc-preview.color-minimal .doc-signature-title { color: #6b7280 !important; }
      .doc-preview.color-minimal .doc-bank-section-title { color: #6b7280 !important; background: rgba(107,114,128,0.08) !important; }

      .doc-preview.with-border { border: 3px double ${accent}; padding: 14mm; }
      .doc-preview.header-centered .doc-header {
        flex-direction: column; align-items: center; text-align: center;
        padding-bottom: 12px; margin-bottom: 14px; border-bottom: 2px solid ${accent}; position: relative;
      }
      .doc-preview.header-centered .doc-brand { flex-direction: column; align-items: center; text-align: center; }
      .doc-preview.header-centered .doc-company-name { font-size: 22px; letter-spacing: 0.5px; }
      .doc-preview.header-centered .doc-company-meta { text-align: center; }
      .doc-preview.header-centered .doc-title { text-align: center; flex: 1; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.08); }
      .doc-preview.header-centered .doc-title-th { font-size: 26px; letter-spacing: 2px; }
      .doc-preview.header-centered .doc-title-en { font-size: 13px; letter-spacing: 1px; color: #6b7280; }
      .doc-preview.header-centered .doc-logo { margin: 0 auto; }

      .doc-preview.layout-classic .doc-section-title { background: ${accent} !important; color: #fff !important; font-weight: 700; letter-spacing: 0.5px; border: none; }
      .doc-preview.layout-classic .doc-items-table { border: 1px solid #d1d5db; }
      .doc-preview.layout-classic .doc-items-table thead th { background: ${soft}; color: ${accent}; font-weight: 700; border-bottom: 2px solid ${accent}; }
      .doc-preview.layout-classic .doc-totals-table .total { background: ${accent} !important; }
      .doc-preview.layout-classic .doc-totals-table .total td { color: #fff !important; font-weight: 700; }
      .doc-preview.layout-classic .doc-totals-table .total .value { color: #fff !important; }
      .doc-preview.layout-classic .doc-amount-words-bar { background: ${accent} !important; color: #fff !important; border-color: ${accent} !important; font-weight: 600; }
      .doc-preview.layout-classic .doc-signature-title { background: ${soft}; padding: 4px 12px; border-radius: 4px; margin-bottom: 16px; }

      .doc-preview.header-full-width .doc-header { background: ${soft}; margin: 0 -16mm; padding: 12px 16mm; margin-bottom: 12px; width: calc(100% + 32mm); }

      .doc-preview.table-striped .doc-items-table tbody tr:nth-child(even) td { background: #f9fafb; }
      .doc-preview.table-striped .doc-items-table { border: none; }
      .doc-preview.table-striped .doc-items-table tbody td { border-bottom: none; }
      .doc-preview.table-striped .doc-section-title { border: none; border-radius: 4px 4px 0 0; }

      .doc-preview.table-clean .doc-items-table { border: none; }
      .doc-preview.table-clean .doc-items-table thead th { background: transparent; border-bottom: 2px solid #e5e7eb; }
      .doc-preview.table-clean .doc-items-table tbody td { border-bottom: 1px solid #f3f4f6; }
      .doc-preview.table-clean .doc-section-title { background: transparent; border: none; border-bottom: 1px solid #d1d5db; padding-left: 0; }
    `;
  }

  /**
   * Strip ALL Svelte scoped class hashes (svelte-xxxxxx) from every element
   * in the clone. This ensures ONLY our injected stylesheet applies —
   * no competing Svelte scoped CSS with var(--doc-accent) that html2canvas
   * might render differently.
   */
  function stripSvelteClasses(root: HTMLElement) {
    root.querySelectorAll('*').forEach(el => {
      const toRemove: string[] = [];
      el.classList.forEach(cls => {
        if (/^s(velte)?-/.test(cls)) toRemove.push(cls);
      });
      toRemove.forEach(cls => el.classList.remove(cls));
    });
    // Also strip from the root itself
    const rootRemove: string[] = [];
    root.classList.forEach(cls => {
      if (/^s(velte)?-/.test(cls)) rootRemove.push(cls);
    });
    rootRemove.forEach(cls => root.classList.remove(cls));
  }

  async function buildPdfClone(mode: 'original' | 'copy'): Promise<{ container: HTMLElement; clone: HTMLElement; pageCount: number } | null> {
    if (!previewBody) return null;

    // Find the live preview source
    const source = previewBody.querySelector('#docPreviewPrint') || previewBody.querySelector('.paginated-doc') || previewBody.querySelector('.doc-preview');
    if (!source) return null;

    // ── Read the accent color from inline CSS variables ──
    // DocPreview.svelte sets inline style="--doc-accent: #xxx; --doc-accent-soft: rgba(...)"
    // We read these DIRECTLY from the style attribute, not from getComputedStyle,
    // to get the exact values before any Svelte scoping or browser rendering.
    const liveDocPreview = source.querySelector('.doc-preview') as HTMLElement || source as HTMLElement;
    let resolvedAccent = '#1e5c8a';
    let resolvedSoft = hexToRgba(resolvedAccent, 0.12);

    const inlineAccent = liveDocPreview.style.getPropertyValue('--doc-accent').trim();
    const inlineSoft = liveDocPreview.style.getPropertyValue('--doc-accent-soft').trim();
    
    if (inlineAccent) {
      resolvedAccent = inlineAccent;
      resolvedSoft = inlineSoft || hexToRgba(inlineAccent, 0.12);
    }

    // Clone the source DOM
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'top left';

    // ── Strip ALL Svelte scoped classes ──
    // This is critical: without this, Svelte's scoped CSS rules
    // (which use var(--doc-accent)) have higher specificity than our
    // injected plain-class rules, causing colors/alignment to be wrong.
    stripSvelteClasses(clone);

    // ── CRITICAL: Remove measure containers FIRST ──
    // PaginatedDocPreview includes a hidden .measure-container with its own .doc-preview.
    // If we count pages before removing these, pageCount is inflated (e.g. 2 instead of 1),
    // causing blank pages in the final PDF.
    clone.querySelectorAll('.measure-container').forEach(el => el.remove());

    // Flatten DOM: unwrap .doc-page-wrapper and .paginated-doc so only .doc-preview
    // elements remain as direct children. This eliminates gap-causing intermediate wrappers.
    clone.querySelectorAll('.doc-page-wrapper').forEach(w => {
      const parent = w.parentNode;
      if (parent) {
        while (w.firstChild) parent.insertBefore(w.firstChild, w);
        w.remove();
      }
    });
    clone.querySelectorAll('.paginated-doc').forEach(p => {
      const parent = p.parentNode;
      if (parent) {
        while (p.firstChild) parent.insertBefore(p.firstChild, p);
        p.remove();
      }
    });

    // Count pages AFTER removing measure containers and flattening
    const pages = clone.querySelectorAll('.doc-preview');
    const pageCount = pages.length || 1;

    // Set page dimensions on each doc-preview (matches GAS) — enforce strict A4
    if (pages.length > 0) {
      pages.forEach(page => {
        (page as HTMLElement).style.cssText += ';width:210mm;height:297mm;overflow:hidden;box-shadow:none;';
      });
    } else {
      clone.style.cssText += ';width:210mm;height:297mm;overflow:hidden;box-shadow:none;';
    }

    // Swap badges
    const badges = clone.querySelectorAll('.doc-badge');
    badges.forEach(badge => {
      if (mode === 'original') {
        badge.innerHTML = `<span style="background:#dbeafe;color:#1e40af;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:500;display:inline-block;">${lang === 'en' ? 'Original' : 'ต้นฉบับ'}</span>`;
      } else {
        badge.innerHTML = `<span style="background:#f3f4f6;color:#6b7280;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:500;display:inline-block;">${copyBadgeText}</span>`;
      }
    });

    // Reset preview-stage transforms (if any)
    const stages = clone.querySelectorAll('.preview-stage');
    stages.forEach(s => { (s as HTMLElement).style.transform = 'none'; });

    // Inject overlay items as static HTML into each page (async for grayscale conversion)
    const overlayHtml = await buildOverlayHtml(overlayItems);
    if (overlayHtml) {
      const docPages = clone.querySelectorAll('.doc-preview');
      if (docPages.length > 0) {
        docPages.forEach(page => { page.insertAdjacentHTML('beforeend', overlayHtml); });
      } else {
        clone.insertAdjacentHTML('beforeend', overlayHtml);
      }
    }

    // ── Inject stylesheet into document.head (NOT inside clone) ──
    // html2canvas only reads stylesheets from document.styleSheets, not inline
    // style tags inside the captured element. We inject into head and remove after capture.
    const styleTag = document.createElement('style');
    styleTag.id = '__pdf-clone-styles__';
    styleTag.textContent = getFullDocStyles(resolvedAccent, resolvedSoft) + '\n' + buildPdfColorOverrides(resolvedAccent, resolvedSoft);
    document.head.appendChild(styleTag);

    // ── Apply critical alignment as INLINE STYLES ──
    // Belt-and-suspenders: even if the stylesheet works, inline styles
    // guarantee html2canvas sees the correct alignment.
    applyInlineAlignmentStyles(clone, resolvedAccent, resolvedSoft);

    // Create hidden off-screen container (matches GAS)
    // Set explicit height to exactly pageCount × 297mm to prevent html2pdf
    // from detecting extra content and adding a blank trailing page.
    const container = document.createElement('div');
    container.style.cssText = `position:absolute;left:0;top:0;width:210mm;height:${pageCount * 297}mm;background:#fff;z-index:-9999;opacity:0;pointer-events:none;overflow:hidden;`;
    clone.style.cssText += `;height:${pageCount * 297}mm;overflow:hidden;`;
    container.appendChild(clone);

    return { container, clone, pageCount };
  }

  /**
   * Apply critical alignment and color styles as INLINE styles on every
   * relevant element in the clone. This guarantees html2canvas renders them
   * correctly, regardless of whether stylesheets are properly parsed.
   */
  function applyInlineAlignmentStyles(root: HTMLElement, accent: string, soft: string) {
    // ── Thai text alignment: padding-top < padding-bottom to push text UP ──
    root.querySelectorAll('.doc-items-table thead th').forEach(el => {
      const e = el as HTMLElement;
      e.style.verticalAlign = 'middle';
      e.style.textAlign = 'center';
      e.style.lineHeight = '1.1';
      e.style.paddingTop = '1px';
      e.style.paddingBottom = '12px';
    });
    root.querySelectorAll('.doc-items-table thead th.right').forEach(el => {
      (el as HTMLElement).style.textAlign = 'right';
    });
    root.querySelectorAll('.doc-items-table tbody td').forEach(el => {
      const e = el as HTMLElement;
      e.style.verticalAlign = 'middle';
      e.style.lineHeight = '1.3';
      e.style.paddingTop = '0px';
      e.style.paddingBottom = '12px';
    });
    root.querySelectorAll('.center').forEach(el => {
      const e = el as HTMLElement;
      e.style.textAlign = 'center';
      e.style.verticalAlign = 'middle';
    });
    root.querySelectorAll('.right').forEach(el => {
      const e = el as HTMLElement;
      e.style.textAlign = 'right';
      e.style.verticalAlign = 'middle';
    });
    root.querySelectorAll('.doc-items-empty').forEach(el => {
      const e = el as HTMLElement;
      e.style.textAlign = 'center';
      e.style.verticalAlign = 'middle';
    });
    root.querySelectorAll('.doc-totals-table td').forEach(el => {
      const e = el as HTMLElement;
      e.style.verticalAlign = 'middle';
      e.style.lineHeight = '1.1';
      e.style.paddingTop = '2px';
      e.style.paddingBottom = '10px';
    });
    root.querySelectorAll('.doc-totals-table .value').forEach(el => {
      const e = el as HTMLElement;
      e.style.textAlign = 'right';
      e.style.verticalAlign = 'middle';
    });
    root.querySelectorAll('.doc-totals-table .total td').forEach(el => {
      const e = el as HTMLElement;
      e.style.verticalAlign = 'middle';
      e.style.fontWeight = '600';
      e.style.lineHeight = '1.1';
      e.style.paddingTop = '2px';
      e.style.paddingBottom = '12px';
    });
    root.querySelectorAll('.doc-section-title').forEach(el => {
      const e = el as HTMLElement;
      e.style.display = 'flex';
      e.style.alignItems = 'center';
      e.style.lineHeight = '1.1';
      e.style.paddingTop = '4px';
      e.style.paddingBottom = '14px';
    });
    root.querySelectorAll('.doc-amount-words-bar').forEach(el => {
      const e = el as HTMLElement;
      e.style.display = 'flex';
      e.style.alignItems = 'center';
      e.style.justifyContent = 'center';
      e.style.textAlign = 'center';
      e.style.lineHeight = '1.1';
      e.style.paddingTop = '2px';
      e.style.paddingBottom = '12px';
    });
    root.querySelectorAll('.doc-badge span').forEach(el => {
      const e = el as HTMLElement;
      e.style.textAlign = 'center';
      e.style.lineHeight = '1.0';
      e.style.paddingTop = '0px';
      e.style.paddingBottom = '10px';
    });
    root.querySelectorAll('.doc-item-code').forEach(el => {
      const e = el as HTMLElement;
      e.style.setProperty('padding-top', '0px', 'important');
      e.style.setProperty('padding-bottom', '12px', 'important');
    });
    root.querySelectorAll('.doc-item-name').forEach(el => {
      const e = el as HTMLElement;
      e.style.setProperty('padding-top', '0px', 'important');
      e.style.setProperty('padding-bottom', '12px', 'important');
    });
    root.querySelectorAll('.doc-detail-row td').forEach(el => {
      const e = el as HTMLElement;
      e.style.setProperty('padding-top', '0px', 'important');
      e.style.setProperty('padding-bottom', '12px', 'important');
    });
    root.querySelectorAll('.doc-detail-text').forEach(el => {
      const e = el as HTMLElement;
      e.style.setProperty('padding-top', '0px', 'important');
      e.style.setProperty('padding-bottom', '12px', 'important');
    });
    root.querySelectorAll('.doc-meta-table td').forEach(el => {
      const e = el as HTMLElement;
      e.style.paddingTop = '0px';
      e.style.paddingBottom = '5px';
    });
    root.querySelectorAll('.doc-terms-title').forEach(el => {
      const e = el as HTMLElement;
      e.style.paddingTop = '2px';
      e.style.paddingBottom = '10px';
    });
    root.querySelectorAll('.doc-terms-body').forEach(el => {
      const e = el as HTMLElement;
      e.style.paddingTop = '2px';
      e.style.paddingBottom = '12px';
    });
    root.querySelectorAll('.doc-bank-section-title').forEach(el => {
      const e = el as HTMLElement;
      e.style.paddingTop = '2px';
      e.style.paddingBottom = '10px';
    });
    root.querySelectorAll('.doc-signature-title').forEach(el => {
      const e = el as HTMLElement;
      e.style.paddingTop = '0px';
      e.style.paddingBottom = '5px';
    });
    root.querySelectorAll('.doc-signature-name').forEach(el => {
      const e = el as HTMLElement;
      e.style.paddingTop = '0px';
      e.style.paddingBottom = '5px';
    });
    root.querySelectorAll('.doc-carry-forward-row td').forEach(el => {
      const e = el as HTMLElement;
      e.style.paddingTop = '1px';
      e.style.paddingBottom = '8px';
    });
    root.querySelectorAll('.doc-brought-forward-cell').forEach(el => {
      const e = el as HTMLElement;
      e.style.setProperty('border-bottom', '1px solid #d1d5db', 'important');
      e.style.setProperty('padding-top', '2px', 'important');
      e.style.setProperty('padding-bottom', '10px', 'important');
      e.style.setProperty('padding-left', '8px', 'important');
      e.style.setProperty('padding-right', '8px', 'important');
      e.style.verticalAlign = 'middle';
    });

    // ── Payment method checkboxes (inline styles for PDF fidelity) ──
    root.querySelectorAll('.doc-pm-line').forEach(el => {
      const e = el as HTMLElement;
      e.style.display = 'flex';
      e.style.alignItems = 'center';
      e.style.flexWrap = 'wrap';
      e.style.gap = '2px 0';
    });
    root.querySelectorAll('.doc-pm-item').forEach(el => {
      const e = el as HTMLElement;
      e.style.display = 'inline-flex';
      e.style.alignItems = 'center';
      e.style.marginLeft = '10px';
      e.style.whiteSpace = 'nowrap';
      e.style.fontSize = '11px';
    });

    // ── Apply accent colors inline (belt-and-suspenders for color fidelity) ──
    root.querySelectorAll('.doc-company-name, .doc-title-th').forEach(el => {
      (el as HTMLElement).style.color = accent;
    });
    root.querySelectorAll('.doc-meta-table .doc-meta-label').forEach(el => {
      (el as HTMLElement).style.color = accent;
    });
    root.querySelectorAll('.doc-section-title').forEach(el => {
      const e = el as HTMLElement;
      e.style.backgroundColor = soft;
      e.style.color = accent;
    });
    root.querySelectorAll('.doc-totals-table .total').forEach(el => {
      const e = el as HTMLElement;
      e.style.backgroundColor = soft;
      e.style.color = accent;
    });
    root.querySelectorAll('.doc-totals-table .total td').forEach(el => {
      (el as HTMLElement).style.color = accent;
    });
    root.querySelectorAll('.doc-totals-table .total .value').forEach(el => {
      (el as HTMLElement).style.color = accent;
    });
    root.querySelectorAll('.doc-amount-words-bar').forEach(el => {
      const e = el as HTMLElement;
      e.style.backgroundColor = soft;
      e.style.borderColor = accent;
      e.style.color = accent;
    });
    root.querySelectorAll('.doc-signature-title').forEach(el => {
      (el as HTMLElement).style.color = accent;
    });
    root.querySelectorAll('.doc-terms-title').forEach(el => {
      (el as HTMLElement).style.color = accent;
    });
    root.querySelectorAll('.doc-bank-section-title').forEach(el => {
      const e = el as HTMLElement;
      e.style.backgroundColor = '#f9fafb';
      e.style.color = accent;
    });
  }

  function hexToRgba(hex: string, alpha: number): string {
    if (!hex) return 'transparent';
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * Download PDF using the Shadow Clone approach.
   * Matches GAS generatePdfFromNode() exactly:
   * 1. Clone DOM into hidden container
   * 2. Inject hardcoded color CSS
   * 3. html2pdf.js captures from clone (width:794, windowWidth:794)
   * 4. Trim blank trailing pages
   * 5. Clean up
   */
  async function doDownloadPdf(mode: 'original' | 'copy', customFilename?: string) {
    pdfBusy = true;
    const pdfFilename = customFilename || filename;

    try {
      const result = await buildPdfClone(mode);
      if (!result) throw new Error('Cannot build PDF clone');

      // Append to document.body so html2canvas can see it
      document.body.appendChild(result.container);

      // Wait for fonts + images to settle in the clone
      await new Promise(r => setTimeout(r, 300));

      const { default: html2pdf } = await import('html2pdf.js');

      // Configure exactly like GAS (js_preview.html:1239-1246)
      const opt: any = {
        margin: 0,
        filename: pdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          width: 794,
          windowWidth: 794,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all'] }
      };

      await html2pdf().set(opt).from(result.clone).toPdf().get('pdf').then((pdf: any) => {
        // Remove blank trailing pages (matches GAS)
        while (pdf.internal.getNumberOfPages() > result.pageCount) {
          pdf.deletePage(pdf.internal.getNumberOfPages());
        }

        // Mobile-friendly download
        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
          const blob = pdf.output('blob');
          const url = URL.createObjectURL(blob);
          // Try anchor download first
          const a = document.createElement('a');
          a.href = url;
          a.download = pdfFilename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          // Fallback: open in new tab so browser handles download
          setTimeout(() => {
            document.body.removeChild(a);
            // If download didn't trigger (some mobile browsers), open blob URL
            if (/iPhone|iPad/i.test(navigator.userAgent)) {
              window.open(url, '_blank');
            }
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          }, 500);
        } else {
          pdf.save(pdfFilename);
        }
      });

      // Cleanup
      document.body.removeChild(result.container);
      document.getElementById('__pdf-clone-styles__')?.remove();
      ondownloadcomplete?.();
    } catch (err) {
      console.error('PDF generation error:', err);
      // Cleanup on error
      const staleContainer = document.querySelector('[style*="z-index:-9999"]');
      if (staleContainer) staleContainer.remove();
      document.getElementById('__pdf-clone-styles__')?.remove();
      ondownloadcomplete?.();
    } finally {
      pdfBusy = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  $effect(() => {
    if (open && typeof window !== 'undefined' && window.innerWidth <= 768) {
      zoomLevel = 66;
    }
  });

  // Auto-trigger print/download when autoAction is set
  $effect(() => {
    if (open && autoAction) {
      const action = autoAction;
      const mode = autoActionMode;
      // Delay to let the preview render first
      const timer = setTimeout(() => {
        if (mode) {
          // Direct mode (bulk): skip CopyModeDialog
          if (action === 'print') {
            doPrint(mode);
          } else if (action === 'download') {
            doDownloadPdf(mode);
          }
        } else {
          // Show CopyModeDialog (single doc)
          if (action === 'print') {
            openPrintCopyMode();
          } else if (action === 'download') {
            openPdfCopyMode();
          }
        }
        onautoactiondone?.();
      }, 400);
      return () => clearTimeout(timer);
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="preview-overlay" onkeydown={handleKeydown}>
    <div class="preview-dialog">
      <!-- Header -->
      <div class="preview-header">
        <h3 class="preview-title">{title}</h3>
        <button type="button" class="preview-close-btn" onclick={onclose} title="ปิด">
          <X size={18} />
        </button>
      </div>

      <!-- Body -->
      <div class="preview-body" bind:this={previewBody}>
        <div class="preview-stage" style="transform: scale({zoomLevel / 100}); transform-origin: top center; position: relative;">
          {@render children()}
          {#if overlayItems.length > 0}
            <InteractiveOverlay items={overlayItems} zoomLevel={zoomLevel} onchange={(newItems) => onoverlaychange?.(newItems)} />
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="preview-footer">
        <div class="preview-actions-left">
          <button type="button" class="preview-action-btn" onclick={openPrintCopyMode}>
            <Printer size={16} />
            <span>พิมพ์</span>
          </button>
          <button type="button" class="preview-action-btn" onclick={openPdfCopyMode} disabled={pdfBusy}>
            {#if pdfBusy}
              <Loader2 size={16} class="spin" />
              <span>กำลังสร้าง PDF...</span>
            {:else}
              <FileText size={16} />
              <span>ดาวน์โหลด PDF</span>
            {/if}
          </button>
        </div>
        <div class="preview-zoom-bar">
          <button type="button" class="preview-zoom-btn" onclick={zoomOut} title="ซูมออก">
            <ZoomOut size={16} />
          </button>
          <span class="preview-zoom-label">{zoomLevel}%</span>
          <button type="button" class="preview-zoom-btn" onclick={zoomIn} title="ซูมเข้า">
            <ZoomIn size={16} />
          </button>
          <button type="button" class="preview-zoom-btn" onclick={zoomFit} title="พอดีหน้าจอ">
            <Maximize size={16} />
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<CopyModeDialog
  open={showCopyMode}
  title={copyModeAction === 'print' ? (lang === 'en' ? 'Select format before printing' : 'เลือกรูปแบบก่อนพิมพ์') : copyModeAction === 'email' ? (lang === 'en' ? 'Select format before sending email' : 'เลือกรูปแบบก่อนส่งอีเมล') : (lang === 'en' ? 'Select format before downloading PDF' : 'เลือกรูปแบบก่อนดาวน์โหลด PDF')}
  {lang}
  onselect={handleCopyModeSelect}
  oncancel={() => showCopyMode = false}
/>

<FilenameDialog
  open={showFilenameDialog}
  defaultFilename={filename}
  onconfirm={handleFilenameConfirm}
  oncancel={() => showFilenameDialog = false}
/>

<EmailComposeDialog
  open={showEmailDialog}
  docNo={docNo}
  customerEmail={customerEmail}
  customerName={customerName}
  pdfBase64={emailPdfBase64}
  pdfFilename={filename}
  onclose={() => showEmailDialog = false}
/>

<style>
  .preview-overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .preview-dialog {
    background: #fff;
    border-radius: 12px;
    width: calc(100vw - 48px);
    max-width: 900px;
    height: calc(100vh - 48px);
    height: calc(100dvh - 48px);
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .preview-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .preview-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    color: #6b7280;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s;
  }
  .preview-close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .preview-body {
    flex: 1;
    overflow: auto;
    background: #d1d5db;
    padding: 24px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .preview-stage {
    transition: transform 0.15s ease;
  }

  .preview-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;
    background: #f9fafb;
  }

  .preview-actions-left {
    display: flex;
    gap: 8px;
  }

  .preview-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid #d1d5db;
    background: #fff;
    color: #374151;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .preview-action-btn:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .preview-zoom-bar {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .preview-zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid #d1d5db;
    background: #fff;
    color: #374151;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .preview-zoom-btn:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .preview-zoom-label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    min-width: 42px;
    text-align: center;
  }

  .preview-action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .preview-dialog {
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      max-width: none;
      border-radius: 0;
    }
    .preview-body {
      padding: 12px;
    }
    .preview-footer {
      padding: 8px 12px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .preview-actions-left {
      gap: 4px;
    }
    .preview-action-btn {
      padding: 5px 8px;
      font-size: 11px;
      gap: 4px;
    }
    .preview-zoom-bar {
      gap: 2px;
    }
    .preview-zoom-btn {
      width: 26px;
      height: 26px;
    }
    .preview-zoom-label {
      font-size: 11px;
      min-width: 34px;
    }
  }
</style>
