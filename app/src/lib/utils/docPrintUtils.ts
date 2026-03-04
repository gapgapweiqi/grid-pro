/**
 * Shared PDF/Print utility functions.
 * Extracted from PreviewModal for reuse in bulk operations.
 */

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return 'transparent';
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function stripSvelteClasses(root: HTMLElement) {
  root.querySelectorAll('*').forEach(el => {
    const toRemove: string[] = [];
    el.classList.forEach(cls => {
      if (/^s(velte)?-/.test(cls)) toRemove.push(cls);
    });
    toRemove.forEach(cls => el.classList.remove(cls));
  });
  const rootRemove: string[] = [];
  root.classList.forEach(cls => {
    if (/^s(velte)?-/.test(cls)) rootRemove.push(cls);
  });
  rootRemove.forEach(cls => root.classList.remove(cls));
}

export function getDocPrintStyles(): string {
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

export function swapBadges(clone: HTMLElement, mode: 'original' | 'copy') {
  const badges = clone.querySelectorAll('.doc-badge');
  badges.forEach(badge => {
    if (mode === 'original') {
      badge.innerHTML = '<span style="background:#dbeafe;color:#1e40af;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:500;display:inline-block;">ต้นฉบับ</span>';
    } else {
      badge.innerHTML = '<span style="background:#f3f4f6;color:#6b7280;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:500;display:inline-block;">สำเนา</span>';
    }
  });
}

export function getFullDocStyles(accent: string, soft: string): string {
  return `
    @page { size: A4; margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; margin: 0; padding: 0; color: #111827; background: #fff; }

    .doc-preview {
      font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
      font-size: 12px; color: #111827; line-height: 1.5;
      padding: 14mm 16mm; box-sizing: border-box;
      position: relative; overflow: hidden;
      width: 210mm; min-height: 297mm; background: #fff;
      box-shadow: none;
    }
    .doc-preview.doc-page { height: 297mm; overflow: hidden; }

    .doc-badge { text-align: right; margin-bottom: 8px; }
    .doc-badge span {
      background: #f3f4f6; color: #6b7280;
      padding-top: 0px; padding-right: 12px; padding-bottom: 10px; padding-left: 12px;
      border-radius: 4px;
      font-size: 11px; font-weight: 500; display: inline-block;
      text-align: center; line-height: 1.0;
    }

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

    .doc-section-title {
      background: ${soft}; color: ${accent};
      padding-top: 4px; padding-right: 12px; padding-bottom: 14px; padding-left: 12px;
      font-weight: 600; font-size: 12px;
      border: 1px solid #e5e7eb; border-bottom: none;
      display: flex; align-items: center; line-height: 1.1;
    }

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

    .doc-carry-forward-row td { border-bottom: none !important; }
    .doc-brought-forward-cell { text-align: right !important; font-weight: 600; padding: 2px 8px 10px 8px !important; font-size: 11px; color: #374151; border-bottom: 1px solid #d1d5db !important; vertical-align: middle !important; }
    .doc-empty-row td { padding: 4px 6px !important; border-bottom: 1px solid #f3f4f6 !important; height: 20px; }

    .doc-watermark {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      width: 280px; height: 280px; z-index: 50;
      pointer-events: none; display: flex; align-items: center; justify-content: center;
    }
    .doc-watermark img { max-width: 100%; max-height: 100%; object-fit: contain; opacity: 0.15; filter: grayscale(100%); }

    .doc-summary { display: flex; gap: 16px; margin-top: 8px; align-items: flex-start; flex-wrap: wrap; }
    .doc-summary-left { flex: 1; min-width: 0; }
    .doc-totals { width: 240px; flex-shrink: 0; }
    .doc-totals-table { width: 100%; font-size: 12px; border-collapse: collapse; }
    .doc-totals-table td { padding-top: 2px; padding-bottom: 10px; padding-left: 0; padding-right: 0; color: #6b7280; vertical-align: middle; line-height: 1.1; }
    .doc-totals-table .value { text-align: right; font-weight: 500; color: #111827; vertical-align: middle; }
    .doc-totals-table .total { background: ${soft}; color: ${accent}; }
    .doc-totals-table .total td { padding-top: 2px; padding-bottom: 12px; padding-left: 6px; padding-right: 6px; font-weight: 600; vertical-align: middle; line-height: 1.1; }
    .doc-totals-table .total .value { font-weight: 700; font-size: 14px; color: ${accent}; vertical-align: middle; }

    .doc-amount-words-bar {
      width: 100%; background: ${soft}; border: 1px solid ${accent};
      border-radius: 4px; padding-top: 2px; padding-right: 12px; padding-bottom: 12px; padding-left: 12px;
      text-align: center !important;
      font-size: 11px; font-weight: 500; color: ${accent};
      margin-top: 8px; margin-bottom: 8px; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center; line-height: 1.1;
    }

    .doc-payment-terms-line { font-size: 11px; color: #374151; margin-bottom: 4px; }
    .doc-pm-line { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 0; }
    .doc-pm-item { display: inline-flex; align-items: center; margin-left: 10px; white-space: nowrap; font-size: 11px; }

    .doc-terms { margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; }
    .doc-terms-title { background: #f9fafb; padding-top: 2px; padding-right: 12px; padding-bottom: 10px; padding-left: 12px; font-weight: 600; font-size: 11px; border-bottom: 1px solid #e5e7eb; color: ${accent}; }
    .doc-terms-body { padding-top: 2px; padding-right: 12px; padding-bottom: 12px; padding-left: 12px; font-size: 11px; color: #374151; line-height: 1.5; }

    .doc-bank-section { margin-top: 8px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .doc-bank-section-title { background: #f9fafb; color: ${accent}; padding-top: 2px; padding-right: 12px; padding-bottom: 10px; padding-left: 12px; font-weight: 600; font-size: 11px; border-bottom: 1px solid #e5e7eb; }
    .doc-bank-section-full { margin-top: 8px; width: 100%; }
    .doc-bank-section .doc-bank-info { margin-top: 0; padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
    .doc-bank-section .doc-bank-info:last-child { border-bottom: none; }
    .doc-bank-info { display: flex; align-items: center; justify-content: flex-start; gap: 16px; margin-top: 8px; }
    .doc-bank-details { font-size: 11px; line-height: 1.5; color: #111827; }
    .doc-bank-qr { width: 60px; height: 60px; flex-shrink: 0; padding: 2px; background: #fff; border: 1px solid #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
    .doc-bank-qr img { width: 100%; height: 100%; object-fit: contain; }

    .doc-signature { display: flex; justify-content: space-between; gap: 16px; margin-top: 16px; padding-top: 8px; }
    .doc-signature-block { text-align: center; width: 160px; }
    .doc-signature-title { font-size: 11px; font-weight: 600; color: ${accent}; margin-bottom: 12px; padding-top: 0px; padding-bottom: 5px; }
    .doc-signature-line { border-top: 1px solid #d1d5db; padding-top: 4px; }
    .doc-signature-name { font-size: 11px; color: #6b7280; }
    .doc-signature-date { font-size: 10px; color: #9ca3af; margin-top: 4px; }
    .doc-signature-image { display: flex; justify-content: center; align-items: flex-end; min-height: 50px; }
    .doc-signature-image img { max-height: 50px; max-width: 150px; object-fit: contain; }

    .doc-note-footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; line-height: 1.6; }

    .paginated-doc { width: 210mm; }
    .doc-page-wrapper { width: 210mm; margin-bottom: 0; }
    .measure-container { display: none !important; }

    .overlay-container { pointer-events: none; }
    .overlay-handle, .overlay-label { display: none !important; }
    .overlay-item { pointer-events: none; }
    .overlay-item.selected { outline: none !important; box-shadow: none !important; }

    /* Template Layout Variants */
    .doc-preview.layout-modern { padding-top: 0; }
    .doc-preview.layout-modern::before {
      content: ''; display: block; height: 8px; background: ${accent};
      margin: 0 -16mm; margin-top: 0; margin-bottom: 14mm; width: calc(100% + 32mm);
    }
    .doc-preview.layout-modern .doc-title-th { font-size: 32px; }
    .doc-preview.layout-modern .doc-company-name { font-size: 22px; }

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

export function buildPdfColorOverrides(accent: string, soft: string): string {
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
    .layout-classic .doc-section-title { background: ${accent} !important; color: #fff !important; }
    .layout-classic .doc-totals-table .total { background: ${accent} !important; }
    .layout-classic .doc-totals-table .total td,
    .layout-classic .doc-totals-table .total .value { color: #fff !important; }
    .layout-classic .doc-amount-words-bar { background: ${accent} !important; color: #fff !important; border-color: ${accent} !important; }
  `;
}

/**
 * Apply Thai text alignment padding (padding-top > padding-bottom) to all text elements.
 * This compensates for Thai descenders making text appear low in html2canvas captures.
 */
export function applyInlineAlignmentPadding(root: HTMLElement) {
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
    e.style.paddingBottom = '22px';
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
    e.style.setProperty('padding-bottom', '22px', 'important');
  });
  root.querySelectorAll('.doc-item-name').forEach(el => {
    const e = el as HTMLElement;
    e.style.setProperty('padding-top', '0px', 'important');
    e.style.setProperty('padding-bottom', '22px', 'important');
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
}

/**
 * Apply accent colors as inline styles within a specific root element.
 */
export function applyInlineAccentColors(root: HTMLElement, accent: string, soft: string) {
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

/**
 * Legacy wrapper: applies both alignment padding and accent colors.
 * Used by single-doc PDF (PreviewModal).
 */
export function applyInlineAlignmentStyles(root: HTMLElement, accent: string, soft: string) {
  applyInlineAlignmentPadding(root);
  applyInlineAccentColors(root, accent, soft);
}

/**
 * Read accent color from a rendered doc-preview element's inline CSS variables.
 */
export function readAccentColor(el: HTMLElement): { accent: string; soft: string } {
  let accent = '#1e5c8a';
  let soft = hexToRgba(accent, 0.12);
  const docPreview = el.querySelector('.doc-preview') as HTMLElement;
  if (docPreview) {
    const inlineAccent = docPreview.style.getPropertyValue('--doc-accent').trim();
    const inlineSoft = docPreview.style.getPropertyValue('--doc-accent-soft').trim();
    if (inlineAccent) {
      accent = inlineAccent;
      soft = inlineSoft || hexToRgba(inlineAccent, 0.12);
    }
  }
  return { accent, soft };
}

/**
 * Build a PDF-ready clone from a rendered container (e.g. hidden bulk container).
 * Returns the offscreen container + clone + page count.
 */
export function buildBulkPdfClone(
  source: HTMLElement,
  mode: 'original' | 'copy'
): { container: HTMLElement; clone: HTMLElement; pageCount: number } {
  // Read per-document accent colors BEFORE cloning — ONLY from visible pages
  // (exclude .measure-container which also contains .doc-preview elements)
  const sourcePages = source.querySelectorAll('.doc-preview');
  const perDocAccents: { accent: string; soft: string }[] = [];
  sourcePages.forEach(page => {
    const p = page as HTMLElement;
    // Skip pages inside .measure-container (PaginatedDocPreview's hidden measurement DOM)
    if (p.closest('.measure-container')) return;
    const a = p.style.getPropertyValue('--doc-accent').trim();
    const s = p.style.getPropertyValue('--doc-accent-soft').trim();
    if (a) {
      perDocAccents.push({ accent: a, soft: s || hexToRgba(a, 0.12) });
    } else {
      perDocAccents.push({ accent: '#1e5c8a', soft: hexToRgba('#1e5c8a', 0.12) });
    }
  });

  // Use first doc's accent for the global stylesheet (fallback)
  const defaultAccent = perDocAccents[0]?.accent || '#1e5c8a';
  const defaultSoft = perDocAccents[0]?.soft || hexToRgba(defaultAccent, 0.12);

  const clone = source.cloneNode(true) as HTMLElement;
  // CRITICAL: Reset clone position — source has position:absolute;left:-9999px
  // which makes the clone invisible inside the container even when container is at left:0
  clone.style.cssText = 'width:210mm;background:#fff;position:static;';

  stripSvelteClasses(clone);

  // ── CRITICAL: Remove measure containers FIRST ──
  // PaginatedDocPreview includes a hidden .measure-container with its own .doc-preview.
  // If we count pages before removing these, pageCount is inflated (e.g. 6 instead of 3
  // for 3 docs), causing blank pages in the final PDF.
  clone.querySelectorAll('.measure-container').forEach(el => el.remove());

  // Flatten DOM: unwrap .doc-page-wrapper and .paginated-doc so only .doc-preview
  // elements remain as direct children. This eliminates all gap-causing intermediate wrappers.
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

  // Enforce strict A4 on each page
  pages.forEach(page => {
    (page as HTMLElement).style.cssText += ';width:210mm;height:297mm;overflow:hidden;box-shadow:none;';
  });

  // Swap badges
  swapBadges(clone, mode);

  // Reset transforms
  clone.querySelectorAll('.preview-stage').forEach(s => { (s as HTMLElement).style.transform = 'none'; });

  // Inject stylesheet into document.head (uses default accent for base styles)
  const styleTag = document.createElement('style');
  styleTag.id = '__pdf-clone-styles__';
  styleTag.textContent = getFullDocStyles(defaultAccent, defaultSoft);
  document.head.appendChild(styleTag);

  // Apply alignment padding globally (no color dependency)
  applyInlineAlignmentPadding(clone);

  // Apply accent colors PER-DOCUMENT — each .doc-preview gets its own accent
  pages.forEach((page, idx) => {
    const { accent, soft } = perDocAccents[idx] || { accent: defaultAccent, soft: defaultSoft };
    applyInlineAccentColors(page as HTMLElement, accent, soft);
  });

  // Create offscreen container with explicit height to prevent blank trailing page
  const container = document.createElement('div');
  container.style.cssText = `position:absolute;left:0;top:0;width:210mm;height:${pageCount * 297}mm;background:#fff;z-index:-9999;pointer-events:none;overflow:hidden;`;
  clone.style.cssText += `;height:${pageCount * 297}mm;overflow:hidden;`;
  container.appendChild(clone);

  return { container, clone, pageCount };
}

/**
 * Get print CSS for print window (simpler than PDF, browser handles rendering).
 */
export function getPrintCss(accent: string, soft: string): string {
  return [
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
    getDocPrintStyles(),
  ].join('\n');
}
