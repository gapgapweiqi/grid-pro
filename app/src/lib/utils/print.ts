/**
 * Shared print helper — works in both browser and Tauri.
 *
 * In Tauri's WebView, `window.open('', '_blank', ...)` returns `null`.
 * This helper detects that and falls back to an invisible iframe-based print.
 */
import { isTauri } from './platform';

export interface PrintOptions {
  title?: string;
  css: string;
  bodyHtml: string;
  /** Called after print is triggered (or fallback shown) */
  onDone?: () => void;
}

/**
 * Build a full HTML document string for printing.
 */
function buildPrintDocument(opts: PrintOptions): string {
  return '<!DOCTYPE html><html><head>'
    + '<meta charset="utf-8"/>'
    + '<title>' + (opts.title || 'Print') + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>'
    + '<style>' + opts.css + '</style>'
    + '</head><body>' + opts.bodyHtml + '</body></html>';
}

/**
 * Remove blank .doc-preview pages (no text and no images).
 */
function removeBlankPages(doc: Document) {
  const pages = doc.querySelectorAll('.doc-preview');
  pages.forEach((page: Element) => {
    const text = (page.textContent || '').trim();
    const hasImages = page.querySelectorAll('img').length > 0;
    if (!text && !hasImages) page.remove();
  });
}

/**
 * Add a fallback "คลิกเพื่อพิมพ์" button to the print document.
 */
function addFallbackPrintButton(win: Window) {
  const btn = win.document.createElement('button');
  btn.textContent = '\u0E04\u0E25\u0E34\u0E01\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1E\u0E34\u0E21\u0E1E\u0E4C'; // คลิกเพื่อพิมพ์
  btn.setAttribute('style', 'position:fixed;top:12px;right:12px;z-index:9999;padding:10px 24px;font-size:15px;font-weight:600;font-family:Sarabun,sans-serif;background:#16a34a;color:#fff;border:none;border-radius:8px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);');
  btn.setAttribute('class', 'no-print');
  btn.onclick = () => { win.print(); };
  const noPrintStyle = win.document.createElement('style');
  noPrintStyle.textContent = '@media print { .no-print { display: none !important; } }';
  win.document.head.appendChild(noPrintStyle);
  win.document.body.appendChild(btn);
}

/**
 * Print via window.open (standard browser approach).
 * Returns true if successful, false if window.open returned null.
 */
function printViaWindow(opts: PrintOptions): boolean {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return false;

  const html = buildPrintDocument(opts);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    removeBlankPages(printWindow.document);
    printWindow.focus();
    try {
      printWindow.print();
    } catch {
      // Auto-print blocked by browser — ignored
    }
    addFallbackPrintButton(printWindow);
    opts.onDone?.();
  };
  return true;
}

/**
 * Print via hidden iframe (Tauri / fallback approach).
 * Creates a temporary invisible iframe, writes the HTML, and triggers print.
 */
function printViaIframe(opts: PrintOptions): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    opts.onDone?.();
    return;
  }

  const html = buildPrintDocument(opts);
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for fonts + images to load before printing
  const iframeWin = iframe.contentWindow;
  if (!iframeWin) {
    document.body.removeChild(iframe);
    opts.onDone?.();
    return;
  }

  iframeWin.onload = () => {
    removeBlankPages(iframeDoc);
    // Small delay for fonts to render
    setTimeout(() => {
      try {
        iframeWin.focus();
        iframeWin.print();
      } catch {
        // Print blocked
      }
      // Clean up after a delay to allow print dialog to appear
      setTimeout(() => {
        document.body.removeChild(iframe);
        opts.onDone?.();
      }, 1000);
    }, 300);
  };
}

/**
 * Print HTML content — auto-detects Tauri and uses iframe fallback if needed.
 * In a normal browser, uses window.open. If that fails (Tauri), falls back to iframe.
 */
export function printHtmlContent(opts: PrintOptions): void {
  // In Tauri, go straight to iframe (window.open always returns null)
  if (isTauri()) {
    printViaIframe(opts);
    return;
  }

  // Try window.open first, fallback to iframe
  const success = printViaWindow(opts);
  if (!success) {
    printViaIframe(opts);
  }
}
