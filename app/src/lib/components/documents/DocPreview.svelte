<script lang="ts">
  import type { Company, Customer, DocType, DocLang, BankAccount } from '$lib/types';
  import type { CalcResult, CustomFeeVatMode } from '$lib/utils/calc';
  import { DOC_CONFIG, DOC_LABELS, getDocConfig, getDocTitle } from '$lib/config/constants';
  import { formatMoney, formatDate, formatTaxId, formatPhone, bahtText, amountToEnglishWords } from '$lib/utils/format';
  import { BUILT_IN_TEMPLATES, type DocTemplate } from '$lib/config/templates';

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
    showStamp = false,
    stampImage = '',
    customFields = [],
    staticOverlayItems = [],
    pageNum = 0,
    totalPages = 0,
    broughtForward = 0,
    carryForward = 0,
    emptyFillCount = 0,
    startIndex = 0,
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
    showStamp?: boolean;
    stampImage?: string;
    customFields?: Array<{label: string; value: string}>;
    staticOverlayItems?: Array<{id: string; src: string; x: number; y: number; width: number; height: number; rotation: number; opacity: number; grayscale: boolean}>;
    pageNum?: number;
    totalPages?: number;
    broughtForward?: number;
    carryForward?: number;
    emptyFillCount?: number;
    startIndex?: number;
    visibleColumns?: VisibleColumns;
  } = $props();

  let config = $derived(getDocConfig(docType));
  let L = $derived((DOC_LABELS[lang] || DOC_LABELS.th) as Record<string, unknown>);
  
  // Template-based styling
  let tpl = $derived.by(() => {
    if (templateId) {
      return BUILT_IN_TEMPLATES.find(t => t.id === templateId) || BUILT_IN_TEMPLATES[0];
    }
    return null;
  });
  let layoutClass = $derived(tpl ? `layout-${tpl.layout}` : '');
  let tableStyleClass = $derived(tpl ? `table-${tpl.config.tableStyle}` : '');
  let colorModeClass = $derived(tpl ? `color-${tpl.config.colorMode}` : '');
  let headerStyleClass = $derived(tpl ? `header-${tpl.config.headerStyle}` : '');
  let showBorderClass = $derived(tpl?.config.showBorder ? 'with-border' : '');
  
  // Responsive Scaling logic
  let previewElement: HTMLElement | undefined = $state();
  let containerWidth = $state(0);
  let previewScale = $state(1);

  const A4_WIDTH_PX = 794;

  $effect(() => {
    if (containerWidth > 0 && containerWidth < A4_WIDTH_PX) {
      previewScale = containerWidth / A4_WIDTH_PX;
    } else {
      previewScale = 1;
    }
  });

  $effect(() => {
    if (!previewElement) return;
    const parent = previewElement.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth = entry.contentRect.width;
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  });

  // Use localStorage color if available, otherwise fallback to config color
  let themeColor = $derived.by(() => {
    if (typeof window !== 'undefined') {
      const savedColor = localStorage.getItem(`docColor.${docType}`);
      if (savedColor) return savedColor;
    }
    return config.color || '#1e5c8a';
  });
  
  let docTitle = $derived(getDocTitle(lang || 'th', docType));
  let docTitleEN = $derived(config.nameEN || docType);
  let partyLabel = $derived(config.showVendor ? (L.vendor as string) : (L.customer as string));
  let companyJson = $derived((company?.json || {}) as Record<string, string>);
  let companyDisplayName = $derived.by(() => {
    const name = company?.name || (L.companyFallback as string);
    const ot = companyJson.officeType as string;
    if (ot === 'hq' || (!ot && companyJson.isHeadOffice)) return name + ' (สำนักงานใหญ่)';
    if (ot === 'branch' && (companyJson.branchName || companyJson.branchNo)) return name + ` (สาขา${companyJson.branchName || companyJson.branchNo})`;
    return name;
  });

  // Auto-shrink font for long doc titles (e.g. ใบเสร็จรับเงิน/ใบกำกับภาษี)
  let docTitleFontSize = $derived(docTitle.length > 12 ? '20px' : docTitle.length > 8 ? '24px' : '28px');
  // Auto-shrink font for long company names
  let companyNameFontSize = $derived(companyDisplayName.length > 40 ? '14px' : companyDisplayName.length > 25 ? '16px' : '18px');

  // Column visibility helpers
  let vc = $derived(visibleColumns || { rowNum: true, code: true, name: true, description: false, qty: true, unit: true, unitPrice: true, discount: true, tax: false });
  let colCount = $derived(
    (vc.rowNum !== false ? 1 : 0) + (vc.code !== false ? 1 : 0) + 1 /* name/desc */ +
    (vc.qty !== false ? 1 : 0) + (vc.unit !== false ? 1 : 0) +
    (vc.unitPrice !== false ? 1 : 0) + (vc.discount !== false ? 1 : 0) +
    (vc.tax ? 1 : 0) + 1 /* total */
  );

  // Tax exempt total — use calc result (properly handles document-level discount proportioning)
  let exemptTotal = $derived(calc.exemptTotal || 0);

  function fmtLineDiscount(line: LineItem): string {
    const dv = line.discountValue || 0;
    if (dv <= 0) return '-';
    const dt = (line.discountType || 'AMOUNT').toUpperCase();
    if (dt === 'PERCENT') return formatMoney(Math.round(line.qty * line.unitPrice * dv / 100 * 100) / 100);
    return formatMoney(dv);
  }

  let hasAnyDiscount = $derived((calc.itemDiscountTotal > 0) || (discountEnabled && calc.discount > 0));
  let totalDiscountAmount = $derived(calc.itemDiscountTotal + (discountEnabled ? calc.discount : 0));
  let discountLabel = $derived(() => {
    let label = L.discount as string;
    if (discountEnabled && discountType === 'PERCENT' && discountValue > 0) {
      label = label + ` (${discountValue}%)`;
    }
    return label;
  });
  let signDateDisplay = $derived(signDate ? formatDate(signDate) : '____/____/________');
  let sign2DateDisplay = $derived(signature2Date ? formatDate(signature2Date) : '____/____/________');
  let sign3DateDisplay = $derived(signature3Date ? formatDate(signature3Date) : '____/____/________');
  let receiverTitle = $derived(signature2Title || ((docType === 'RCPT' || docType === 'TAXRCPT') && L.receiverOfRCPT ? (L.receiverOfRCPT as string) : ((L.receiverOf as string) + ' ' + docTitle)));
  let issuerTitle = $derived(signatureTitle || ((docType === 'RCPT' || docType === 'TAXRCPT') && L.issuerOfRCPT ? (L.issuerOfRCPT as string) : ((L.issuerOf as string) + ' ' + docTitle)));
  let sig3Title = $derived(signature3Title || (docType === 'TAXRCPT' ? 'ผู้ส่งมอบสินค้า/บริการ' : 'ผู้อนุมัติ' + docTitle));
  let emptyName = '(\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0)';
  let issuerName = $derived(signatureName ? `( ${signatureName} )` : emptyName);
  let receiver2Name = $derived(signature2Name ? `( ${signature2Name} )` : emptyName);
  let approver3Name = $derived(signature3Name ? `( ${signature3Name} )` : emptyName);
  let sigBlockCount = $derived((signatureEnabled ? 1 : 0) + (signature2Enabled ? 1 : 0) + (signature3Enabled ? 1 : 0));

  function hexToRgba(hex: string, alpha: number): string {
    if (!hex) return 'transparent';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function formatAccountNo(no: string): string {
    const clean = no.replace(/\D/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0,3)}-${clean.slice(3,4)}-${clean.slice(4,9)}-${clean.slice(9)}`;
    }
    return no;
  }

  // Pagination helpers
  let isMultiPage = $derived(totalPages > 1);
  let isFirstPage = $derived(pageNum === 1);
  let isLastPage = $derived(pageNum === totalPages);
  let showCustomerSection = $derived(!isMultiPage || isFirstPage);
  let showSummarySection = $derived(!isMultiPage || isLastPage);
  let showBankBelowAmountWords = $derived(!!terms && showBankInfo && selectedBankAccounts.length > 0);
  let hasBankCard = $derived(showBankInfo && selectedBankAccounts.length > 0);
  let hasAnyPaymentMethod = $derived(showPaymentMethod && paymentMethodItems.length > 0);
  // Payment terms position: always 'below-bank' when bank card exists (either in summary-left or full-width)
  let paymentTermsPosition = $derived.by(() => {
    if (!showPaymentTerms || !paymentTermsLabel) return 'hidden';
    if (hasBankCard) return 'below-bank';
    return 'standalone';
  });
  let pageStyle = $derived.by(() => {
    if (isMultiPage) {
      return 'height: 297mm; overflow: hidden;';
    }
    return 'min-height: 297mm;';
  });
</script>

<div 
  class="doc-preview {layoutClass} {tableStyleClass} {colorModeClass} {headerStyleClass} {showBorderClass}" 
  class:doc-page={isMultiPage} 
  bind:this={previewElement}
  style="--doc-accent: {themeColor}; --doc-accent-soft: {hexToRgba(themeColor, 0.12)}; {pageStyle} --scale: {previewScale}; margin-bottom: {previewScale < 1 ? `calc(-297mm * (1 - ${previewScale}))` : '0'};"
>
  {#if isMultiPage}
    <!-- Page indicator + badge for multi-page docs (matches GAS) -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:11px;color:#6b7280;">{L.pageLabel || 'หน้า'} {pageNum} {L.pageOf || 'จาก'} {totalPages}</div>
      <div class="doc-badge"><span>{L.copyBadge || 'สำเนา'}</span></div>
    </div>
  {:else}
    <!-- Single page badge (matches GAS) -->
    <div class="doc-badge"><span>{L.copyBadge || 'สำเนา'}</span></div>
  {/if}
  <!-- Header: Logo + Company (left), Doc Title (right) -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-logo">
        {#if companyJson.logo}
          <img src={companyJson.logo} alt="logo" />
        {:else}
          <span class="doc-logo-fallback">🏢</span>
        {/if}
      </div>
      <div class="doc-company">
        <div class="doc-company-name" style="font-size: {companyNameFontSize}">{companyDisplayName}</div>
        <div class="doc-company-meta">
          {#if company}
            {company.address || ''}<br/>
            {#if company.phone || company.email}{#if company.phone}{L.phone}: {formatPhone(company.phone)}{/if}{#if company.phone && company.email} | {/if}{#if company.email}{company.email}{/if}<br/>{/if}
            {#if company.taxId}<span style="white-space:nowrap">{L.taxId}: {formatTaxId(company.taxId)}</span>{/if}
          {:else}
            <span style="color:#9ca3af">{L.companyFallback}</span>
          {/if}
        </div>
      </div>
    </div>
    <div class="doc-title">
      <div class="doc-title-th" style="font-size: {docTitleFontSize}">{docTitle}</div>
      <div class="doc-title-en">{docTitleEN}</div>
    </div>
  </div>

  <!-- Parties: Customer Info (left) + Doc Meta Table (right) — only on first page or single page -->
  {#if showCustomerSection}
  <div class="doc-parties">
    <div class="doc-customer-info">
      <div class="doc-ci-header">{partyLabel}</div>
      {#if customer}
        {@const custJson = (customer.json || {}) as Record<string, unknown>}
        {@const custOt = custJson.officeType as string}
        {@const custBranchLabel = (custOt === 'hq' || (!custOt && custJson.isHeadOffice === true)) ? ' (สำนักงานใหญ่)' : (custOt === 'branch' || (!custOt && custJson.isHeadOffice === false)) ? ((custJson.branchName || custJson.branchNo) ? ` (สาขา${custJson.branchName || custJson.branchNo})` : '') : ''}
        <div class="doc-ci-name">{customer.name}{custBranchLabel}</div>
        {#if customer.address}<div class="doc-ci-detail">{customer.address}</div>{/if}
        {#if customer.phone || customer.email}
          <div class="doc-ci-detail">
            {#if customer.phone}{L.phone}: {formatPhone(customer.phone)}{/if}
            {#if customer.phone && customer.email} | {/if}
            {#if customer.email}{customer.email}{/if}
          </div>
        {/if}
        {#if customer.taxId}<div class="doc-ci-detail">{L.taxId}: {formatTaxId(customer.taxId)}</div>{/if}
        {#if contactPerson}<div class="doc-ci-detail">ผู้ติดต่อ: {contactPerson}</div>{/if}
        {#if customFields && customFields.length > 0}
          {@const validCfs = customFields.filter(cf => cf.label && cf.value)}
          {#if validCfs.length > 0}
            <div class="doc-ci-detail">{validCfs.map(cf => `${cf.label}: ${cf.value}`).join(' , ')}</div>
          {/if}
        {/if}
      {:else}
        <div class="doc-ci-name" style="color: #9ca3af;">ยังไม่ได้เลือกลูกค้า</div>
      {/if}
    </div>
    <div class="doc-meta">
      <table class="doc-meta-table">
        <tbody>
          <tr><td class="doc-meta-label">{L.docNoLabel}</td><td class="doc-meta-value">{docNo || '-'}</td></tr>
          <tr><td class="doc-meta-label">{L.date}</td><td class="doc-meta-value">{docDate ? formatDate(docDate) : '-'}</td></tr>
          {#if (config.showDueDate || config.showValidUntil) && dueDate}
            <tr><td class="doc-meta-label">{config.showValidUntil ? L.validUntil : L.dueDate}</td><td class="doc-meta-value">{formatDate(dueDate)}</td></tr>
          {/if}
          {#if !config.showVendor && salespersonName}
            <tr><td class="doc-meta-label">{L.salespersonLabel}</td><td class="doc-meta-value">{salespersonName}</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
  {/if}

  <!-- Items Section Title -->
  <div class="doc-section-title">{L.itemsTitle}</div>

  <!-- Items Table -->
  <table class="doc-items-table">
    <thead>
      <tr>
        {#if vc.rowNum !== false}<th class="center" style="width: 40px;">#</th>{/if}
        {#if vc.code !== false}<th class="center" style="width: 70px;">{L.codeCol}</th>{/if}
        <th>{L.descCol}</th>
        {#if vc.qty !== false}<th class="center" style="width: 60px;">{L.qtyCol}</th>{/if}
        {#if vc.unit !== false}<th class="center" style="width: 60px;">{L.unitCol}</th>{/if}
        {#if vc.unitPrice !== false}<th class="right" style="width: 90px;">{L.unitPriceCol}</th>{/if}
        {#if vc.discount !== false}<th class="right" style="width: 70px;">{L.discount}</th>{/if}
        {#if vc.tax}<th class="center" style="width: 60px;">{L.taxCol}</th>{/if}
        <th class="right" style="width: 90px;">{L.totalCol}</th>
      </tr>
    </thead>
    <tbody>
      {#if isMultiPage && !isFirstPage && broughtForward > 0}
        <tr class="doc-carry-forward-row doc-brought-forward">
          <td colspan={colCount} class="doc-brought-forward-cell">{L.broughtForward || 'ยอดยกมา'}: ฿ {broughtForward.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
        </tr>
      {/if}
      {#each lines as line, i}
        {#if line.name}
          <tr class="doc-item-row">
            {#if vc.rowNum !== false}<td class="center">{startIndex + i + 1}</td>{/if}
            {#if vc.code !== false}<td class="center doc-item-code">{line.code || ''}</td>{/if}
            <td class="doc-item-name">
              {line.name}
              {#if vc.description && (line.description || line.details)}
                {#each ((line.description || '') + '\n' + (line.details || '')).split('\n').filter(l => l.trim()) as detailLine}
                  <div class="doc-item-desc">- {detailLine.trim().replace(/^-\s*/, '')}</div>
                {/each}
              {/if}
            </td>
            {#if vc.qty !== false}<td class="center">{line.qty}</td>{/if}
            {#if vc.unit !== false}<td class="center">{line.unit || '-'}</td>{/if}
            {#if vc.unitPrice !== false}<td class="right">{formatMoney(line.unitPrice)}</td>{/if}
            {#if vc.discount !== false}<td class="right">{fmtLineDiscount(line)}</td>{/if}
            {#if vc.tax}<td class="center" style="font-size: 9px;">{line.taxRate === 'exempt' ? (L.taxExempt || 'ยกเว้น') : line.taxRate === 'none' || !line.taxRate ? (L.taxNone || '-') : line.taxRate + '%'}</td>{/if}
            <td class="right doc-item-total">{formatMoney(line.lineTotal)}</td>
          </tr>
        {/if}
      {/each}
      {#if !lines.some(l => l.name)}
        <tr><td colspan={colCount} class="doc-items-empty">{L.noItems}</td></tr>
      {/if}
      {#if isMultiPage && !isLastPage}
        {#each Array(emptyFillCount) as _}
          <tr class="doc-empty-row"><td colspan={colCount}>&nbsp;</td></tr>
        {/each}
        {#if carryForward > 0}
          <tr class="doc-carry-forward-row">
            <td colspan={colCount} style="text-align:right;font-weight:600;padding:1px 8px 2px 8px;border-top:1px solid #d1d5db;font-size:11px;color:#374151;">{L.carryForward || 'ยอดยกไป'}: ฿ {carryForward.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
          </tr>
        {/if}
      {/if}
    </tbody>
  </table>

  <!-- Summary: Terms/Bank (left) + Totals (right) — only on last page or single page -->
  {#if showSummarySection}
  <div class="doc-summary">
    <div class="doc-summary-left">
      {#if terms}
        <div class="doc-terms">
          <div class="doc-terms-title">{L.termsAndConditions}</div>
          <div class="doc-terms-body">{@html terms.split('\n').map(l => l.trim()).filter(Boolean).join('<br/>')}</div>
        </div>
      {/if}
      {#if !showBankBelowAmountWords && showBankInfo && selectedBankAccounts.length > 0}
        <div class="doc-bank-section">
          <div class="doc-bank-section-title">{L.paymentTitle || 'การชำระเงิน'}</div>
          {#each selectedBankAccounts as bank}
            <div class="doc-bank-info">
              <div class="doc-bank-details">
                <div><strong>{L.bankLabel}{bank.bankName}</strong> {bank.branch || ''}</div>
                <div><strong>{L.accountNo}:</strong> {formatAccountNo(bank.accountNo)}</div>
                <div><strong>{L.accountNameLabel}:</strong> {bank.accountName}</div>
              </div>
              {#if bank.qrCodeImage}
                <div class="doc-bank-qr">
                  <img src={bank.qrCodeImage} alt="QR Code" />
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else if !showBankBelowAmountWords && companyJson.bankName}
        <div class="doc-bank-info" style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; background: #fff;">
          <div class="doc-bank-details">
            <div><strong>{L.bankLabel}{companyJson.bankName}</strong> {companyJson.bankBranch || ''}</div>
            <div><strong>{L.accountNo}:</strong> {formatAccountNo(companyJson.bankAccount || '')}</div>
            <div><strong>{L.accountNameLabel}:</strong> {companyJson.bankAccountName || company?.name || ''}</div>
          </div>
        </div>
      {/if}
      {#if (hasAnyPaymentMethod && !showBankBelowAmountWords) || (paymentTermsPosition === 'below-bank' && !showBankBelowAmountWords)}
        <div class="doc-payment-terms-line doc-pm-line" style="margin-top: 8px;">
          {#if hasAnyPaymentMethod}
            <strong>ชำระโดย:</strong>
            {#each paymentMethodItems as pm}
              <span class="doc-pm-item">{pm.checked ? '[✓]' : '[　]'} {pm.label}</span>
            {/each}
          {/if}
          {#if hasAnyPaymentMethod && paymentTermsPosition === 'below-bank'}<span style="margin: 0 8px;">|</span>{/if}
          {#if paymentTermsPosition === 'below-bank'}<strong>{L.paymentTerms}:</strong> {paymentTermsLabel}{/if}
        </div>
      {/if}
    </div>
    <div class="doc-totals">
      <table class="doc-totals-table">
        <tbody>
        <tr><td>{L.subtotal}</td><td class="value">{formatMoney(calc.subtotal)}</td></tr>
        {#if hasAnyDiscount}
          <tr><td>{discountLabel()}</td><td class="value">-{formatMoney(totalDiscountAmount)}</td></tr>
          <tr><td>{L.afterDiscount}</td><td class="value">{formatMoney(calc.afterItemDiscount - calc.discount)}</td></tr>
        {/if}
        {#if showCustomFee && customFeeAmount > 0 && customFeeVatMode === 'EXCLUSIVE'}
          <tr><td>{customFeeName || 'ค่าใช้จ่ายเพิ่มเติม'}</td><td class="value">{formatMoney(customFeeAmount)}</td></tr>
        {/if}
        {#if vatEnabled && vatInclusive}
          <tr><td>{L.beforeTax}</td><td class="value">{formatMoney(calc.preTaxBase)}</td></tr>
        {/if}
        {#if vatEnabled}
          <tr><td>{L.vat} ({vatRate}%)</td><td class="value">{formatMoney(calc.vatAmount)}</td></tr>
        {/if}
        {#if whtEnabled}
          <tr><td>{L.wht} ({whtRate}%)</td><td class="value">-{formatMoney(calc.whtAmount)}</td></tr>
        {/if}
        {#if showCustomFee && customFeeAmount > 0 && customFeeVatMode === 'NO_VAT'}
          <tr><td>{customFeeName || 'ค่าใช้จ่ายเพิ่มเติม'}</td><td class="value">{formatMoney(customFeeAmount)}</td></tr>
        {/if}
        {#if exemptTotal > 0}
          <tr><td>{L.exemptTotal || 'มูลค่ายกเว้นภาษี'}</td><td class="value">{formatMoney(exemptTotal)}</td></tr>
        {/if}
        <tr class="total"><td>{L.grandTotal}</td><td class="value">{formatMoney(calc.grandTotal)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Amount in Words -->
  <div class="doc-amount-words-bar">( {lang === 'en' ? amountToEnglishWords(calc.grandTotal) : bahtText(calc.grandTotal)} )</div>

  <!-- Bank info below amount words (full-width) when terms exist -->
  {#if showBankBelowAmountWords}
    <div class="doc-bank-section doc-bank-section-full">
      <div class="doc-bank-section-title">{L.paymentTitle || 'การชำระเงิน'}</div>
      {#each selectedBankAccounts as bank}
        <div class="doc-bank-info">
          <div class="doc-bank-details">
            <div><strong>{L.bankLabel}{bank.bankName}</strong> {bank.branch || ''}</div>
            <div><strong>{L.accountNo}:</strong> {formatAccountNo(bank.accountNo)}</div>
            <div><strong>{L.accountNameLabel}:</strong> {bank.accountName}</div>
          </div>
          {#if bank.qrCodeImage}
            <div class="doc-bank-qr">
              <img src={bank.qrCodeImage} alt="QR Code" />
            </div>
          {/if}
        </div>
      {/each}
    </div>
    {#if hasAnyPaymentMethod || paymentTermsPosition === 'below-bank'}
      <div class="doc-payment-terms-line doc-pm-line" style="margin-top: 6px;">
        {#if hasAnyPaymentMethod}
          <strong>ชำระโดย:</strong>
          {#each paymentMethodItems as pm}
            <span class="doc-pm-item">{pm.checked ? '[✓]' : '[　]'} {pm.label}</span>
          {/each}
        {/if}
        {#if hasAnyPaymentMethod && paymentTermsPosition === 'below-bank'}<span style="margin: 0 8px;">|</span>{/if}
        {#if paymentTermsPosition === 'below-bank'}<strong>{L.paymentTerms}:</strong> {paymentTermsLabel}{/if}
      </div>
    {/if}
  {/if}

  <!-- Payment Method + Terms (standalone — when no bank and no full-width bank section) -->
  {#if (hasAnyPaymentMethod && !hasBankCard && !showBankBelowAmountWords) || paymentTermsPosition === 'standalone'}
    <div class="doc-payment-terms-line doc-pm-line" style="margin-top: 6px;">
      {#if hasAnyPaymentMethod && !hasBankCard && !showBankBelowAmountWords}
        <strong>ชำระโดย:</strong>
        {#each paymentMethodItems as pm}
          <span class="doc-pm-item">{pm.checked ? '[✓]' : '[　]'} {pm.label}</span>
        {/each}
      {/if}
      {#if hasAnyPaymentMethod && !hasBankCard && !showBankBelowAmountWords && paymentTermsPosition === 'standalone'}<span style="margin: 0 8px;">|</span>{/if}
      {#if paymentTermsPosition === 'standalone'}<strong>{L.paymentTerms}:</strong> {paymentTermsLabel}{/if}
    </div>
  {/if}

  <!-- Signature -->
  {#if sigBlockCount > 0}
    <div class="doc-signature" class:sig-three={sigBlockCount === 3}>
      {#if signature2Enabled}
        <div class="doc-signature-block">
          <div class="doc-signature-title">{receiverTitle}</div>
          {#if signature2Image}
            <div class="doc-signature-image"><img src={signature2Image} alt="signature" /></div>
          {:else}
            <div style="min-height: 50px;"></div>
          {/if}
          <div class="doc-signature-line">
            <div class="doc-signature-name">{receiver2Name}</div>
            <div class="doc-signature-date">{L.dateSigned} {sign2DateDisplay}</div>
          </div>
        </div>
      {/if}
      {#if signature3Enabled}
        <div class="doc-signature-block">
          <div class="doc-signature-title">{sig3Title}</div>
          {#if signature3Image}
            <div class="doc-signature-image"><img src={signature3Image} alt="signature" /></div>
          {:else}
            <div style="min-height: 50px;"></div>
          {/if}
          <div class="doc-signature-line">
            <div class="doc-signature-name">{approver3Name}</div>
            <div class="doc-signature-date">{L.dateSigned} {sign3DateDisplay}</div>
          </div>
        </div>
      {/if}
      {#if signatureEnabled}
        <div class="doc-signature-block">
          <div class="doc-signature-title">{issuerTitle}</div>
          {#if signatureImage}
            <div class="doc-signature-image"><img src={signatureImage} alt="signature" /></div>
          {:else}
            <div style="min-height: 50px;"></div>
          {/if}
          <div class="doc-signature-line">
            <div class="doc-signature-name">{issuerName}</div>
            <div class="doc-signature-date">{L.dateSigned} {signDateDisplay}</div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Notes -->
  {#if notes}
    <div class="doc-note-footer"><strong>{L.notes}:</strong><br/>{@html notes.split('\n').map(l => l.trim()).filter(Boolean).join('<br/>')}</div>
  {/if}
  {/if}

  <!-- Stamp/Watermark from overlay items (rendered statically on page 2+) -->
  {#if staticOverlayItems && staticOverlayItems.length > 0}
    {#each staticOverlayItems.filter(i => i.src) as item}
      <div style="position:absolute;left:{item.x}mm;top:{item.y}mm;width:{item.width}mm;height:{item.height}mm;transform:rotate({item.rotation}deg);opacity:{item.opacity};{item.grayscale ? 'filter:grayscale(100%);' : ''}z-index:50;pointer-events:none;display:flex;align-items:center;justify-content:center;">
        <img src={item.src} alt="stamp" style="max-width:100%;max-height:100%;object-fit:contain;" />
      </div>
    {/each}
  {/if}
</div>

<style>
  /* ===== A4 Document Preview (ported from GAS app_css.html) ===== */
  .doc-preview {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    padding: 14mm 16mm;
    box-sizing: border-box;
    font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
    font-size: 12px;
    color: #111827;
    line-height: 1.5;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    position: relative;
  }

  /* Header */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .doc-brand {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    min-width: 0;
    flex: 1 1 320px;
  }
  .doc-logo {
    width: 80px;
    height: 80px;
    background: #f3f4f6;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .doc-logo img { max-width: 100%; max-height: 100%; }
  .doc-logo-fallback { font-size: 32px; }
  .doc-company-name {
    font-size: 20px;
    font-weight: 700;
    color: var(--doc-accent, #1e5c8a);
    margin-bottom: 4px;
    overflow-wrap: anywhere;
  }
  .doc-company-meta {
    font-size: 11px;
    color: #6b7280;
    line-height: 1.6;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .doc-title {
    text-align: right;
    min-width: 0;
    flex: 0 1 220px;
  }
  .doc-title-th {
    font-size: 28px;
    font-weight: 700;
    color: var(--doc-accent, #1e5c8a);
    overflow-wrap: anywhere;
  }
  .doc-title-en {
    font-size: 14px;
    color: #9ca3af;
    margin-top: 2px;
  }

  /* Parties */
  .doc-parties {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }
  .doc-customer-info { flex: 1; min-width: 0; }
  .doc-ci-header {
    font-size: 11px;
    color: #6b7280;
    font-weight: 600;
    text-decoration: underline;
    margin-bottom: 2px;
    margin-top: 4px;
  }
  .doc-ci-name {
    font-size: 12px;
    color: #111827;
    font-weight: 600;
    line-height: 1.5;
  }
  .doc-ci-detail {
    font-size: 11px;
    color: #374151;
    line-height: 1.5;
    word-break: break-word;
  }
  .doc-meta { flex-shrink: 0; }
  .doc-meta-table { border-collapse: collapse; font-size: 11px; }
  .doc-meta-table td { padding: 2px 0; }
  .doc-meta-table .doc-meta-label {
    color: var(--doc-accent, #1e5c8a);
    font-weight: 600;
    padding-right: 12px;
    white-space: nowrap;
    font-size: 11px;
  }
  .doc-meta-table .doc-meta-value {
    font-weight: 600;
    color: #111827;
    min-width: 120px;
    font-size: 11px;
    padding-left: 8px;
  }

  /* Section Title */
  .doc-section-title {
    background: var(--doc-accent-soft, rgba(30,92,138,0.12));
    color: var(--doc-accent, #1e5c8a);
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border: 1px solid #e5e7eb;
    border-bottom: none;
  }

  /* Items Table */
  .doc-items-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #e5e7eb;
    border-top: none;
  }
  .doc-items-table thead th {
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
    font-size: 11px;
    color: #374151;
    font-weight: 600;
    padding: 7px 8px;
  }
  .doc-items-table tbody td {
    padding: 4px 6px;
    font-size: 11px;
    line-height: 1.4;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .doc-item-code { font-size: 10px; color: #6b7280; }
  .doc-item-name { font-weight: 500; line-height: 1.4; font-size: 11px; overflow-wrap: anywhere; }
  .doc-item-desc { font-size: 10px; line-height: 1.4; color: #6b7280; }
  .doc-item-total { font-weight: 600; }
  .doc-items-empty { padding: 40px; text-align: center; color: #9ca3af; }
  .doc-brought-forward-cell {
    text-align: right;
    font-weight: 600;
    padding: 6px 8px;
    font-size: 11px;
    color: #374151;
    border-bottom: 1px solid #d1d5db !important;
  }
  .doc-detail-row td { padding: 2px 6px !important; border-bottom: none !important; }
  .doc-detail-text { font-size: 0.85em; color: var(--color-gray-600); text-align: left; padding-left: 0 !important; }
  .center { text-align: center; }
  .right { text-align: right; }

  /* Watermark/Stamp (matches GAS doc-watermark) */
  .doc-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    width: 280px;
    height: 280px;
    z-index: 50; /* Bring to front */
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    mix-blend-mode: multiply; /* Helps it look like a real stamp over text */
  }
  .doc-watermark img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    opacity: 0.15; /* Increased slightly since it's now grayscale */
    filter: grayscale(100%); /* Force black and white */
  }

  /* Badge (matches GAS exactly) */
  .doc-badge {
    text-align: right;
    margin-bottom: 8px;
  }
  .doc-badge span {
    background: #f3f4f6;
    color: #6b7280;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    display: inline-block;
  }

  /* Carry-forward / brought-forward rows */
  .doc-carry-forward-row td {
    border-bottom: none !important;
  }
  
  /* Brought-forward (ยอดยกมา) needs border to separate from items */
  .doc-brought-forward td {
    border-bottom: 1px solid #e5e7eb !important;
  }

  /* Empty filler rows */
  .doc-empty-row td {
    padding: 4px 6px !important;
    border-bottom: 1px solid #f3f4f6 !important;
    height: 20px;
  }

  /* Multi-page doc page */
  .doc-preview.doc-page {
    page-break-after: always;
  }

  /* Summary */
  .doc-summary {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .doc-summary-left { flex: 1; min-width: 0; }
  .doc-totals { width: 240px; flex-shrink: 0; }
  .doc-totals-table { width: 100%; font-size: 12px; }
  .doc-totals-table td { padding: 6px 0; color: #6b7280; }
  .doc-totals-table .value { text-align: right; font-weight: 500; color: #111827; }
  .doc-totals-table .total { background: var(--doc-accent-soft, rgba(30,92,138,0.12)); color: var(--doc-accent, #1e5c8a); }
  .doc-totals-table .total td { padding: 8px 6px; font-weight: 600; }
  .doc-totals-table .total .value { font-weight: 700; font-size: 14px; color: var(--doc-accent, #1e5c8a); }

  /* Amount Words Bar */
  .doc-amount-words-bar {
    width: 100%;
    background: var(--doc-accent-soft, rgba(30,92,138,0.12));
    border: 1px solid var(--doc-accent, #1e5c8a);
    border-radius: 4px;
    padding: 8px 12px;
    text-align: center;
    font-size: 11px;
    font-weight: 500;
    color: var(--doc-accent, #1e5c8a);
    margin-top: 8px;
    margin-bottom: 8px;
  }

  /* Payment Terms */
  .doc-payment-terms-line {
    font-size: 11px;
    color: #374151;
    margin-bottom: 4px;
  }
  .doc-pm-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px 0;
  }
  .doc-pm-item {
    display: inline-flex;
    align-items: center;
    margin-left: 10px;
    white-space: nowrap;
    font-size: 11px;
  }

  /* Terms */
  .doc-terms {
    margin-bottom: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }
  .doc-terms-title {
    background: #f9fafb;
    padding: 6px 12px;
    font-weight: 600;
    font-size: 11px;
    border-bottom: 1px solid #e5e7eb;
    color: var(--doc-accent, #1e5c8a);
  }
  .doc-terms-body {
    padding: 8px 12px;
    font-size: 11px;
    color: #374151;
    line-height: 1.5;
  }

  /* Bank Section */
  .doc-bank-section {
    margin-top: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }
  .doc-bank-section-title {
    background: #f9fafb;
    color: var(--doc-accent, #1e5c8a);
    padding: 6px 12px;
    font-weight: 600;
    font-size: 11px;
    border-bottom: 1px solid #e5e7eb;
  }
  .doc-bank-section-full {
    margin-top: 8px;
    width: 100%;
  }
  .doc-bank-section .doc-bank-info {
    margin-top: 0;
    padding: 8px 12px;
    border-bottom: 1px solid #f3f4f6;
  }
  .doc-bank-section .doc-bank-info:last-child {
    border-bottom: none;
  }

  /* Bank Info */
  .doc-bank-info {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    margin-top: 8px;
  }
  .doc-bank-details {
    font-size: 11px;
    line-height: 1.5;
    color: #111827;
  }
  .doc-bank-qr {
    width: 60px;
    height: 60px;
    flex-shrink: 0;
    padding: 2px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .doc-bank-qr img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Signature */
  .doc-signature {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 16px;
    padding-top: 8px;
  }
  .doc-signature-block { text-align: center; width: 160px; flex-shrink: 0; }
  .doc-signature.sig-three { gap: 10px; justify-content: space-around; }
  .doc-signature.sig-three .doc-signature-block { width: 140px; }
  .doc-signature-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--doc-accent, #1e5c8a);
    margin-bottom: 12px;
  }
  .doc-signature-line { border-top: 1px solid #d1d5db; padding-top: 4px; }
  .doc-signature-name { font-size: 11px; color: #6b7280; }
  .doc-signature-date { font-size: 10px; color: #9ca3af; margin-top: 4px; }
  .doc-signature-image { display: flex; justify-content: center; align-items: flex-end; min-height: 50px; }
  .doc-signature-image img { max-height: 50px; max-width: 150px; object-fit: contain; }
  .doc-signature.sig-three .doc-signature-image img { max-width: 130px; }

  /* Notes Footer */
  .doc-note-footer {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    font-size: 11px;
    color: #6b7280;
    line-height: 1.6;
  }

  /* Custom Fields */
  .doc-ci-custom-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-top: 4px;
    font-size: 11px;
    color: #374151;
  }
  .doc-ci-custom-item {
    white-space: nowrap;
  }

  /* ===== Template Layout Variants ===== */
  
  /* Modern: accent bar top, larger title */
  .doc-preview.layout-modern { padding-top: 0; }
  .doc-preview.layout-modern::before {
    content: '';
    display: block;
    height: 8px;
    background: var(--doc-accent, #1e5c8a);
    margin: 0 -16mm;
    margin-top: 0;
    margin-bottom: 14mm;
    width: calc(100% + 32mm);
  }
  .doc-preview.layout-modern .doc-title-th { font-size: 32px; }
  .doc-preview.layout-modern .doc-company-name { font-size: 22px; }

  /* Minimal: monochrome, thin lines */
  .doc-preview.color-minimal { --doc-accent: #6b7280 !important; --doc-accent-soft: rgba(107,114,128,0.08) !important; }
  .doc-preview.color-minimal .doc-section-title { background: transparent; border: none; border-bottom: 1px solid #d1d5db; }
  .doc-preview.color-minimal .doc-amount-words-bar { border-color: #d1d5db; background: #f9fafb; color: #374151; }
  .doc-preview.color-minimal .doc-totals-table .total { background: #f9fafb; }
  .doc-preview.color-minimal .doc-totals-table .total td { color: #374151; }
  .doc-preview.color-minimal .doc-totals-table .total .value { color: #111827; }
  .doc-preview.color-minimal .doc-title-th { font-size: 24px; }

  /* Classic: formal document style — double border, centered header with divider */
  .doc-preview.with-border {
    border: 3px double var(--doc-accent, #1e5c8a);
    padding: 14mm;
  }
  .doc-preview.header-centered .doc-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-bottom: 12px;
    margin-bottom: 14px;
    border-bottom: 2px solid var(--doc-accent, #1e5c8a);
    position: relative;
  }
  .doc-preview.header-centered .doc-header::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--doc-accent, #1e5c8a);
    opacity: 0.4;
  }
  .doc-preview.header-centered .doc-brand {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .doc-preview.header-centered .doc-company-name {
    font-size: 22px;
    letter-spacing: 0.5px;
  }
  .doc-preview.header-centered .doc-company-meta { text-align: center; }
  .doc-preview.header-centered .doc-title {
    text-align: center;
    flex: 1;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(0,0,0,0.08);
  }
  .doc-preview.header-centered .doc-title-th {
    font-size: 26px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .doc-preview.header-centered .doc-title-en {
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6b7280;
  }
  .doc-preview.header-centered .doc-logo { margin: 0 auto; }
  .doc-preview.layout-classic .doc-section-title {
    background: var(--doc-accent, #1e5c8a);
    color: #fff;
    font-weight: 700;
    letter-spacing: 0.5px;
    border: none;
  }
  .doc-preview.layout-classic .doc-items-table {
    border: 1px solid #d1d5db;
  }
  .doc-preview.layout-classic .doc-items-table thead th {
    background: var(--doc-accent-soft, rgba(30,92,138,0.08));
    color: var(--doc-accent, #1e5c8a);
    font-weight: 700;
    border-bottom: 2px solid var(--doc-accent, #1e5c8a);
  }
  .doc-preview.layout-classic .doc-totals-table .total {
    background: var(--doc-accent, #1e5c8a);
  }
  .doc-preview.layout-classic .doc-totals-table .total td {
    color: #fff;
    font-weight: 700;
  }
  .doc-preview.layout-classic .doc-totals-table .total .value {
    color: #fff;
  }
  .doc-preview.layout-classic .doc-amount-words-bar {
    background: var(--doc-accent, #1e5c8a);
    color: #fff;
    border-color: var(--doc-accent, #1e5c8a);
    font-weight: 600;
  }
  .doc-preview.layout-classic .doc-signature-block {
    border-top: none;
    padding-top: 0;
  }
  .doc-preview.layout-classic .doc-signature-title {
    background: var(--doc-accent-soft, rgba(30,92,138,0.08));
    padding: 4px 12px;
    border-radius: 4px;
    margin-bottom: 16px;
  }

  /* Full-width header (modern) */
  .doc-preview.header-full-width .doc-header { 
    background: var(--doc-accent-soft, rgba(30,92,138,0.12)); 
    margin: 0 -16mm; 
    padding: 12px 16mm; 
    margin-bottom: 12px; 
    width: calc(100% + 32mm); 
  }

  /* Table Style: striped */
  .doc-preview.table-striped .doc-items-table tbody tr:nth-child(even) td { background: #f9fafb; }
  .doc-preview.table-striped .doc-items-table { border: none; }
  .doc-preview.table-striped .doc-items-table tbody td { border-bottom: none; }
  .doc-preview.table-striped .doc-section-title { border: none; border-radius: 4px 4px 0 0; }

  /* Table Style: clean */
  .doc-preview.table-clean .doc-items-table { border: none; }
  .doc-preview.table-clean .doc-items-table thead th { background: transparent; border-bottom: 2px solid #e5e7eb; }
  .doc-preview.table-clean .doc-items-table tbody td { border-bottom: 1px solid #f3f4f6; }
  .doc-preview.table-clean .doc-section-title { background: transparent; border: none; border-bottom: 1px solid #d1d5db; padding-left: 0; }

  @media print {
    .doc-preview { box-shadow: none; }
  }

  /* Mobile responsive - scale down to fit mobile screens */
  .doc-preview {
    transform: scale(var(--scale, 1));
    transform-origin: top left;
  }
</style>
