/**
 * Document Paginator — measures DOM heights and splits line items into page chunks.
 * Ported from the GAS project's js_preview.html pagination system.
 */

export interface PageChunk {
  /** Item indices in this page */
  indices: number[];
  /** Running total up to and including this page */
  cumulativeTotal: number;
}

export interface PaginationResult {
  /** Array of page chunks, each containing item indices */
  pages: PageChunk[];
  /** Whether the document fits on a single page */
  isSinglePage: boolean;
  /** Scale factor for shrinking a single-page doc that barely overflows (0 = no shrink) */
  shrinkFactor: number;
}

export interface MeasuredHeights {
  pageH: number;        // Usable page height (297mm - buffer in px)
  badgeH: number;       // Copy/Original badge row
  pageIndicatorH: number; // "Page 1/2" indicator row
  headerH: number;      // Company header + doc title
  customerH: number;    // Customer info + meta table
  sectionTitleH: number; // "รายการสินค้า" section title
  theadH: number;       // Table header row
  itemHeights: number[]; // Height of each item row (including detail sub-rows)
  summaryH: number;     // Summary section (totals, signature, notes, etc.)
  carryForwardH: number; // Carry-forward / brought-forward row
  emptyRowH: number;    // Single empty filler row
}

/**
 * Measure all section heights by temporarily rendering them offscreen.
 * Must be called from the browser (DOM required).
 */
export function measureDocHeights(containerEl: HTMLElement): MeasuredHeights | null {
  try {
    const outer = document.createElement('div');
    outer.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;width:210mm;';
    document.body.appendChild(outer);

    // Measure actual content area: 297mm page with 14mm top+bottom padding
    const pageContainer = document.createElement('div');
    pageContainer.style.cssText = 'height:297mm;width:210mm;padding:14mm 16mm;box-sizing:border-box;';
    const innerRuler = document.createElement('div');
    innerRuler.style.cssText = 'height:100%;width:1px;';
    pageContainer.appendChild(innerRuler);
    outer.appendChild(pageContainer);
    const contentH = innerRuler.offsetHeight;
    pageContainer.remove();
    if (!contentH || contentH < 100) { outer.remove(); return null; }

    // Subtract 3mm safety buffer for rendering differences
    const bufRuler = document.createElement('div');
    bufRuler.style.cssText = 'height:3mm;width:1px;';
    outer.appendChild(bufRuler);
    const finalPageH = contentH - bufRuler.offsetHeight;
    bufRuler.remove();

    // Clone the preview and measure sections
    // NOTE: containerEl is .measure-container which wraps DocPreview.
    // DocPreview already has its own padding:14mm 16mm via CSS, so no extra padding on the clone.
    const clone = containerEl.cloneNode(true) as HTMLElement;
    clone.style.cssText = 'width:210mm;margin:0;position:relative;';
    outer.appendChild(clone);

    function measureSelector(selector: string): number {
      const el = clone.querySelector(selector) as HTMLElement;
      if (!el) return 0;
      return el.offsetHeight + parseFloat(getComputedStyle(el).marginTop || '0') + parseFloat(getComputedStyle(el).marginBottom || '0');
    }

    const badgeH = measureSelector('.doc-badge') || 30; // Measure actual badge element
    const headerH = measureSelector('.doc-header');
    const customerH = measureSelector('.doc-parties');
    const sectionTitleH = measureSelector('.doc-section-title');
    const summaryEl = clone.querySelector('.doc-summary');
    const signatureEl = clone.querySelector('.doc-signature');
    const amountWordsEl = clone.querySelector('.doc-amount-words-bar');
    const noteEl = clone.querySelector('.doc-note-footer');
    const payTermsEl = clone.querySelector('.doc-payment-terms-line');
    const bankFullEl = clone.querySelector('.doc-bank-section-full');
    const bankPayRowEl = clone.querySelector('.doc-bank-payment-row');
    const payTermsSideEl = clone.querySelector('.doc-payment-terms-side');
    let summaryH = 0;
    [summaryEl, signatureEl, amountWordsEl, noteEl, payTermsEl, bankFullEl, bankPayRowEl, payTermsSideEl].forEach(el => {
      if (el) summaryH += (el as HTMLElement).offsetHeight + 8;
    });

    // Measure thead
    const thead = clone.querySelector('.doc-items-table thead') as HTMLElement;
    const theadH = thead ? thead.offsetHeight : 0;

    // Measure each item row (including its detail sub-rows)
    const tbody = clone.querySelector('.doc-items-table tbody');
    const itemHeights: number[] = [];
    if (tbody) {
      const allTrs = tbody.querySelectorAll('tr');
      let curH = 0;
      for (let r = 0; r < allTrs.length; r++) {
        if (allTrs[r].classList.contains('doc-item-row')) {
          if (r > 0 && curH > 0) itemHeights.push(curH);
          curH = allTrs[r].offsetHeight;
        } else if (allTrs[r].classList.contains('doc-detail-row')) {
          curH += allTrs[r].offsetHeight;
        } else if (allTrs[r].classList.contains('doc-items-empty')) {
          // Skip empty placeholder row
        } else {
          curH += allTrs[r].offsetHeight;
        }
      }
      if (curH > 0) itemHeights.push(curH);
    }

    // Measure page indicator row height
    const pageIndicatorH = 28; // ~28px for "Page 1/2" + badge row

    // Measure carry-forward row
    const carryForwardH = 30; // ~30px for carry-forward row

    // Measure empty filler row
    const emptyRowH = 24; // ~24px for an empty row

    clone.remove();
    outer.remove();

    return {
      pageH: finalPageH,
      badgeH,
      pageIndicatorH,
      headerH,
      customerH,
      sectionTitleH,
      theadH,
      itemHeights,
      summaryH,
      carryForwardH,
      emptyRowH
    };
  } catch (e) {
    console.error('[DocPaginator] measureDocHeights error:', e);
    return null;
  }
}

/**
 * Split item indices into page chunks based on measured heights.
 */
export function splitItemsByHeight(m: MeasuredHeights, cfH: number = 0): { chunks: number[][]; isSingle: boolean } {
  const total = m.itemHeights.length;
  if (total === 0) return { chunks: [[]], isSingle: true };

  // Check if everything fits on a single page
  const singleOverhead = m.badgeH + m.headerH + m.customerH + m.sectionTitleH + m.theadH;
  let itemsH = 0;
  let allFit = true;
  for (let i = 0; i < total; i++) {
    itemsH += m.itemHeights[i];
    if (singleOverhead + itemsH + m.summaryH > m.pageH) { allFit = false; break; }
  }
  if (allFit) {
    const arr = Array.from({ length: total }, (_, i) => i);
    return { chunks: [arr], isSingle: true };
  }

  // Multi-page split
  const chunks: number[][] = [];
  let idx = 0;

  // First page: has page indicator + header + customer + sectionTitle + thead
  const firstOverhead = m.pageIndicatorH + m.headerH + m.customerH + m.sectionTitleH + m.theadH;
  const firstAvail = m.pageH - firstOverhead - cfH;
  const firstChunk: number[] = [];
  let used = 0;
  while (idx < total) {
    if (used + m.itemHeights[idx] > firstAvail && firstChunk.length > 0) break;
    firstChunk.push(idx);
    used += m.itemHeights[idx];
    idx++;
  }
  chunks.push(firstChunk);

  // Continuation pages overhead (no customer info)
  const contOverhead = m.pageIndicatorH + m.headerH + m.sectionTitleH + m.theadH;

  while (idx < total) {
    // Check if remaining items fit on a last page (with summary)
    let remainH = 0;
    for (let k = idx; k < total; k++) remainH += m.itemHeights[k];

    const lastAvail = m.pageH - contOverhead - m.summaryH - cfH;
    if (remainH <= lastAvail || idx === total - 1) {
      const lastChunk: number[] = [];
      while (idx < total) { lastChunk.push(idx); idx++; }
      chunks.push(lastChunk);
    } else {
      // Middle page: no summary, has carry-forward on both sides
      const pageAvail = m.pageH - contOverhead - (cfH * 2);
      const chunk: number[] = [];
      let pgUsed = 0;
      while (idx < total - 1) {
        if (pgUsed + m.itemHeights[idx] > pageAvail && chunk.length > 0) break;
        chunk.push(idx);
        pgUsed += m.itemHeights[idx];
        idx++;
      }
      if (chunk.length === 0) { chunk.push(idx); idx++; }
      chunks.push(chunk);
    }
  }

  // Widow/orphan prevention: ensure last page has at least 2 items
  if (chunks.length >= 2) {
    const lastChunk = chunks[chunks.length - 1];
    const prevChunk = chunks[chunks.length - 2];
    while (lastChunk.length < 2 && prevChunk.length > 1) {
      lastChunk.unshift(prevChunk.pop()!);
    }
  }

  return { chunks, isSingle: false };
}

/**
 * Main pagination function: measures and splits document content into pages.
 * Returns PaginationResult with page chunks and carry-forward totals.
 */
export function paginateDocument(
  containerEl: HTMLElement,
  itemAmounts: number[]
): PaginationResult {
  const m = measureDocHeights(containerEl);
  const totalItems = itemAmounts.length;

  if (!m || m.itemHeights.length !== totalItems) {
    // Fallback: use simple row-count-based splitting
    const FALLBACK = { singlePage: 7, firstPage: 9, contPage: 15, lastPage: 7 };
    if (totalItems <= FALLBACK.singlePage) {
      return {
        pages: [{ indices: Array.from({ length: totalItems }, (_, i) => i), cumulativeTotal: itemAmounts.reduce((a, b) => a + b, 0) }],
        isSinglePage: true,
        shrinkFactor: 0
      };
    }
    // Multi-page fallback
    const chunks: number[][] = [];
    let ci = 0;
    const fc = Math.min(totalItems, FALLBACK.firstPage);
    chunks.push(Array.from({ length: fc }, (_, i) => i));
    ci = fc;
    while (ci < totalItems) {
      const rem = totalItems - ci;
      if (rem <= FALLBACK.lastPage) {
        const cl: number[] = [];
        while (ci < totalItems) { cl.push(ci); ci++; }
        chunks.push(cl);
      } else {
        const tk = Math.min(FALLBACK.contPage, rem - 1);
        chunks.push(Array.from({ length: tk }, (_, i) => ci + i));
        ci += tk;
      }
    }
    return buildResult(chunks, itemAmounts, false);
  }

  const split = splitItemsByHeight(m, m.carryForwardH);
  let chunks = split.chunks;

  // Single page validation: check if content actually overflows
  if (chunks.length === 1 && totalItems > 0) {
    // Check real overflow by comparing total content height to page height
    const singleOverhead = m.badgeH + m.headerH + m.customerH + m.sectionTitleH + m.theadH;
    let totalItemH = 0;
    for (let i = 0; i < totalItems; i++) totalItemH += m.itemHeights[i];
    const actualH = singleOverhead + totalItemH + m.summaryH;

    if (actualH > m.pageH) {
      if (totalItems === 1) {
        // Single item that overflows: shrink to fit
        const factor = Math.floor((m.pageH / actualH) * 100) / 100;
        return {
          pages: [{ indices: [0], cumulativeTotal: itemAmounts[0] || 0 }],
          isSinglePage: true,
          shrinkFactor: factor
        };
      }
      // Re-split for multi-page
      const reSplit = splitItemsByHeight(m, m.carryForwardH);
      chunks = reSplit.chunks;

      // Safety: if still 1 page with multiple items, force split
      // Keep as many items as possible on page 1, move at least 2 to page 2
      if (chunks.length === 1 && totalItems > 1) {
        const keepOnPage1 = Math.max(1, totalItems - 2);
        chunks = [
          Array.from({ length: keepOnPage1 }, (_, i) => i),
          Array.from({ length: totalItems - keepOnPage1 }, (_, i) => keepOnPage1 + i)
        ];
      }
    }
  }

  // Widow/orphan final pass
  chunks = chunks.filter(c => c.length > 0);
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    while (last.length < 2 && prev.length > 2) {
      last.unshift(prev.pop()!);
    }
  }

  return buildResult(chunks, itemAmounts, chunks.length === 1);
}

function buildResult(chunks: number[][], itemAmounts: number[], isSinglePage: boolean): PaginationResult {
  let runSum = 0;
  const pages: PageChunk[] = chunks.filter(c => c.length > 0).map(chunk => {
    for (const idx of chunk) {
      runSum += (itemAmounts[idx] || 0);
    }
    return { indices: chunk, cumulativeTotal: runSum };
  });

  return {
    pages,
    isSinglePage: pages.length <= 1,
    shrinkFactor: 0
  };
}

/**
 * Calculate the number of empty filler rows needed on a non-last page.
 */
export function calcEmptyFillRows(
  m: MeasuredHeights,
  pageIndex: number,
  chunks: PageChunk[],
  isFirst: boolean
): number {
  if (!m || m.emptyRowH <= 0) return 0;

  const pgOverhead = isFirst
    ? m.pageIndicatorH + m.headerH + m.customerH + m.sectionTitleH + m.theadH
    : m.pageIndicatorH + m.headerH + m.sectionTitleH + m.theadH;

  let usedH = 0;
  for (const idx of chunks[pageIndex].indices) {
    usedH += (m.itemHeights[idx] || 0);
  }

  const bfRowH = !isFirst ? m.carryForwardH : 0;
  const cfRowH = m.carryForwardH;
  const spaceLeft = m.pageH - pgOverhead - usedH - bfRowH - cfRowH;
  return Math.max(0, Math.floor(spaceLeft / m.emptyRowH));
}
