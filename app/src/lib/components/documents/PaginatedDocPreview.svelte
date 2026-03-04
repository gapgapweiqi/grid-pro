<script lang="ts">
  import { tick } from 'svelte';
  import DocPreview from './DocPreview.svelte';
  import { paginateDocument, type PaginationResult, type PageChunk } from '$lib/utils/docPaginator';
  import type { Company, Customer, DocType, DocLang, BankAccount } from '$lib/types';
  import type { CalcResult, CustomFeeVatMode } from '$lib/utils/calc';

  interface LineItem {
    name: string;
    description?: string;
    code?: string;
    qty: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    details?: string;
    taxRate?: string;
    discountType?: string;
    discountValue?: number;
  }

  interface VisibleColumns {
    rowNum?: boolean;
    code?: boolean;
    name?: boolean;
    description?: boolean;
    qty?: boolean;
    unit?: boolean;
    unitPrice?: boolean;
    discount?: boolean;
    tax?: boolean;
  }

  let {
    docType = 'QUO',
    docNo = '',
    docDate = '',
    dueDate = '',
    lang = 'th',
    company = null,
    customer = null,
    lines = [],
    calc,
    discountEnabled = false,
    discountType = 'AMOUNT',
    discountValue = 0,
    vatEnabled = true,
    vatRate = 7,
    vatInclusive = false,
    whtEnabled = false,
    whtRate = 3,
    signatureEnabled = true,
    signatureTitle = '',
    signatureName = '',
    signatureImage = '',
    signDate = '',
    signature2Enabled = false,
    signature2Title = '',
    signature2Name = '',
    signature2Image = '',
    signature2Date = '',
    signature3Enabled = false,
    signature3Title = '',
    signature3Name = '',
    signature3Image = '',
    signature3Date = '',
    showStamp = false,
    stampImage = '',
    overlayItems = [],
    notes = '',
    terms = '',
    salespersonName = '',
    contactPerson = '',
    showPaymentMethod = false,
    paymentMethodItems = [] as Array<{label: string; checked: boolean}>,
    showPaymentTerms = false,
    paymentTermsLabel = '',
    customFeeName = '',
    customFeeAmount = 0,
    showCustomFee = false,
    customFeeVatMode = 'NO_VAT',
    showBankInfo = false,
    selectedBankAccounts = [],
    templateId = '',
    copyMode = '',
    customFields = [],
    visibleColumns = { rowNum: true, code: true, name: true, description: false, qty: true, unit: true, unitPrice: true, discount: true, tax: false },
  }: {
    docType: DocType;
    docNo: string;
    docDate: string;
    dueDate: string;
    lang?: DocLang;
    company: Company | null;
    customer: Customer | null;
    lines: LineItem[];
    calc: CalcResult;
    discountEnabled: boolean;
    discountType: string;
    discountValue: number;
    vatEnabled: boolean;
    vatRate: number;
    vatInclusive?: boolean;
    whtEnabled: boolean;
    whtRate: number;
    signatureEnabled: boolean;
    signatureTitle?: string;
    signatureName?: string;
    signatureImage?: string;
    signDate?: string;
    signature2Enabled?: boolean;
    signature2Title?: string;
    signature2Name?: string;
    signature2Image?: string;
    signature2Date?: string;
    signature3Enabled?: boolean;
    signature3Title?: string;
    signature3Name?: string;
    signature3Image?: string;
    signature3Date?: string;
    showStamp?: boolean;
    stampImage?: string;
    overlayItems?: Array<{id: string; src: string; x: number; y: number; width: number; height: number; rotation: number; opacity: number; grayscale: boolean}>;
    notes: string;
    terms: string;
    salespersonName?: string;
    contactPerson?: string;
    showPaymentMethod?: boolean;
    paymentMethodItems?: Array<{label: string; checked: boolean}>;
    showPaymentTerms?: boolean;
    paymentTermsLabel?: string;
    customFeeName?: string;
    customFeeAmount?: number;
    showCustomFee?: boolean;
    customFeeVatMode?: CustomFeeVatMode;
    showBankInfo?: boolean;
    selectedBankAccounts?: BankAccount[];
    templateId?: string;
    copyMode?: string;
    customFields?: Array<{label: string; value: string}>;
    visibleColumns?: VisibleColumns;
  } = $props();

  // Pagination state
  let paginationResult: PaginationResult | null = $state(null);
  let measureEl: HTMLDivElement | undefined = $state();

  // Filtered lines (only ones with names)
  let validLines = $derived(lines.filter(l => l.name.trim()));
  let itemAmounts = $derived(validLines.map(l => l.lineTotal));

  // Run pagination whenever lines change or on mount
  $effect(() => {
    // Read reactive dependencies to track them
    const _len = validLines.length;
    const _amounts = itemAmounts;
    const _el = measureEl;

    // Schedule pagination after DOM update (untracked to avoid write-back loop)
    tick().then(() => {
      if (!measureEl) return;
      const result = paginateDocument(measureEl, _amounts);
      // Use queueMicrotask to batch the state update outside the effect
      queueMicrotask(() => {
        paginationResult = result;
      });
    });
  });

  // Build page data from pagination result
  let pageData = $derived.by(() => {
    if (!paginationResult || paginationResult.isSinglePage) {
      // Single page: return all lines as-is
      return [{
        pageNum: 0,
        totalPages: 0,
        lines: validLines,
        broughtForward: 0,
        carryForward: 0,
        emptyFillCount: 0,
        startIndex: 0
      }];
    }

    const pages = paginationResult.pages;
    return pages.map((page, pi) => {
      const pageLines = page.indices.map(idx => validLines[idx]);
      const prevTotal = pi > 0 ? pages[pi - 1].cumulativeTotal : 0;
      const isLast = pi === pages.length - 1;

      return {
        pageNum: pi + 1,
        totalPages: pages.length,
        lines: pageLines,
        broughtForward: pi > 0 ? prevTotal : 0,
        carryForward: !isLast ? page.cumulativeTotal : 0,
        emptyFillCount: 0,
        startIndex: page.indices[0] || 0
      };
    });
  });
</script>

<!-- Hidden measurement container: renders a single-page DocPreview for DOM measurement -->
<div class="measure-container" bind:this={measureEl} aria-hidden="true">
  <DocPreview
    {docType} {docNo} {docDate} {dueDate} {lang}
    {company} {customer}
    lines={validLines}
    {calc}
    {discountEnabled} {discountType} {discountValue}
    {vatEnabled} {vatRate} {vatInclusive}
    {whtEnabled} {whtRate}
    {signatureEnabled} {signatureTitle} {signatureName} {signatureImage} {signDate}
    {signature2Enabled} {signature2Title} {signature2Name} {signature2Image} {signature2Date}
    {signature3Enabled} {signature3Title} {signature3Name} {signature3Image} {signature3Date}
    {showStamp} {stampImage}
    {notes} {terms} {salespersonName} {contactPerson}
    {showPaymentMethod} {paymentMethodItems}
    {showPaymentTerms} {paymentTermsLabel}
    {customFeeName} {customFeeAmount} {showCustomFee} {customFeeVatMode}
    {showBankInfo} {selectedBankAccounts}
    {templateId} {customFields}
    {visibleColumns}
  />
</div>

<!-- Rendered pages -->
<div class="paginated-doc" id="docPreviewPrint">
  {#each pageData as pg, i (i)}
    <div class="doc-page-wrapper" style={pageData.length > 1 && i < pageData.length - 1 ? 'margin-bottom: 20px;' : ''}>
      <DocPreview
        {docType} {docNo} {docDate} {dueDate} {lang}
        {company} {customer}
        lines={pg.lines}
        {calc}
        {discountEnabled} {discountType} {discountValue}
        {vatEnabled} {vatRate} {vatInclusive}
        {whtEnabled} {whtRate}
        {signatureEnabled} {signatureName} {signatureImage} {signDate}
        {signature2Enabled} {signature2Name} {signature2Image} {signature2Date}
        {signature3Enabled} {signature3Title} {signature3Name} {signature3Image} {signature3Date}
        {showStamp} {stampImage}
        staticOverlayItems={overlayItems}
        {notes} {terms} {salespersonName} {contactPerson}
        {showPaymentMethod} {paymentMethodItems}
        {showPaymentTerms} {paymentTermsLabel}
        {customFeeName} {customFeeAmount} {showCustomFee} {customFeeVatMode}
        {showBankInfo} {selectedBankAccounts}
        {templateId} {customFields}
        {visibleColumns}
        {copyMode}
        pageNum={pg.pageNum}
        totalPages={pg.totalPages}
        broughtForward={pg.broughtForward}
        carryForward={pg.carryForward}
        emptyFillCount={pg.emptyFillCount}
        startIndex={pg.startIndex}
      />
    </div>
  {/each}
</div>

<style>
  .measure-container {
    position: absolute;
    left: -9999px;
    top: 0;
    visibility: hidden;
    pointer-events: none;
    width: 210mm;
    z-index: -9999;
  }

  .paginated-doc {
    width: 210mm;
  }

  .doc-page-wrapper {
    width: 210mm;
  }
</style>
