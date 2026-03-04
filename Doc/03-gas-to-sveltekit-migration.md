# GAS → SvelteKit Migration Guide

## แนวทางการ Migrate

### หลักการ
1. **GAS = Source of Truth** — ใช้ GAS เป็นตัวอ้างอิงสำหรับ logic, layout, fields ทั้งหมด
2. **100% Fidelity** — Preview ต้องเหมือน GAS pixel-perfect
3. **Constants First** — Port configuration/labels ก่อน แล้วค่อย port components

### Mapping: GAS Files → SvelteKit Files

| GAS File              | SvelteKit Target                          | Status |
|-----------------------|-------------------------------------------|--------|
| `js_config.html`      | `lib/config/constants.ts`                 | ✅ Done |
| `js_preview.html`     | `lib/components/documents/DocPreview.svelte` | ✅ Done |
| `app_css.html` (doc)  | `DocPreview.svelte <style>`               | ✅ Done |
| `js_document.html`    | `routes/documents/+page.svelte`           | ✅ Done |
| `js_utils.html`       | `lib/utils/format.ts` + `helpers.ts`      | ✅ Done |
| `js_state.html`       | `lib/stores/app.ts`                       | ✅ Done |
| `js_master.html`      | `routes/customers/`, `products/`, `salespersons/` | ✅ Done |
| `js_dashboard.html`   | `routes/+page.svelte` (Dashboard)         | ✅ Done |
| `js_dochistory.html`  | `routes/documents/history/+page.svelte`   | ✅ Done |
| `js_payments.html`    | `routes/payments/+page.svelte`            | ✅ Done |
| `js_company.html`     | `routes/companies/+page.svelte`           | ✅ Done |
| `Api.gs`              | `lib/services/api.ts`                     | ✅ Mock |
| `Repo.gs`             | `lib/services/memory-adapter.ts`          | ✅ Mock |
| `DocumentService.gs`  | Phase 2 (Cloudflare Workers)              | ⏳      |
| `SequenceService.gs`  | `lib/utils/sequence.ts`                   | ✅ Done |
| `Utils.gs`            | `lib/utils/calc.ts`                       | ✅ Done |

## Calculation Engine Migration

### GAS (js_document.html)
```javascript
function recalcDocument() {
  // reads DOM values, loops items, applies per-item discount, 
  // global discount, VAT (inclusive/exclusive), WHT
}
```

### SvelteKit (lib/utils/calc.ts)
```typescript
export function calculateDocument(input: CalcInput): CalcResult {
  // Pure function, no DOM dependency
  // Same logic: per-item discount → global discount → VAT → WHT → custom fee
}
```

**Key differences:**
- GAS reads from DOM → SvelteKit uses reactive `$derived`
- GAS mutates DOM → SvelteKit returns `CalcResult` object
- SvelteKit added `customFeeEnabled` / `vatInclusive` that GAS handles differently

## Preview HTML Migration

### GAS (js_preview.html → `generatePreviewHTML()`)
- Builds HTML string from DOM values
- ~1000 lines of string concatenation
- Uses `generateDocPages()` for multi-page splitting

### SvelteKit (DocPreview.svelte)
- Svelte component with props
- Same HTML structure, same CSS classes
- Reactive rendering via `$derived`
- CSS ported from `app_css.html` lines 1305-2002

### Sections mapped:
1. **doc-header** — Logo + company info (left) + doc title (right)
2. **doc-parties** — Customer info (left) + doc meta table (right)
3. **doc-items-table** — Dynamic columns from `DOC_CONFIG.itemColumns`
4. **doc-summary** — Terms/bank info (left) + totals table (right)
5. **doc-amount-words-bar** — Thai baht text
6. **doc-payment-terms-line** — Payment terms with preset dropdown
7. **doc-signature** — Receiver (left) + Issuer (right) with name/date
8. **doc-note-footer** — Notes section

## Document Form Migration

### New fields added to SvelteKit (matching GAS):
- **Salesperson dropdown** — `salespersonId` + `salespersonName`
- **Contact person** — free text
- **Per-line discount** — each line has `discountType` (AMOUNT/PERCENT) + `discountValue`
- **VAT inclusive** mode — checkbox next to VAT rate
- **Custom fee** — name + amount with enable toggle
- **Signature name + date** — for issuer signature block
- **Payment terms** — preset dropdown (เงินสด, เครดิต 7/15/30/45/60 วัน, กำหนดเอง)
- **Dynamic field visibility** — controlled by `getDocConfig(docType)`

### DOC_CONFIG field visibility:
| Field                   | QUO | INV | RCPT | TAX | DN | PO | BIL |
|-------------------------|-----|-----|------|-----|----|----|-----|
| showDueDate             | ❌  | ✅  | ❌   | ❌  | ❌ | ❌ | ✅  |
| showValidUntil          | ✅  | ❌  | ❌   | ❌  | ❌ | ❌ | ❌  |
| showVendor              | ❌  | ❌  | ❌   | ❌  | ❌ | ✅ | ❌  |
| showPaymentTerms        | ✅  | ✅  | ❌   | ✅  | ❌ | ✅ | ✅  |
| showTermsAndConditions  | ✅  | ✅  | ❌   | ✅  | ❌ | ✅ | ❌  |
| showBankInfo            | ❌  | ✅  | ✅   | ✅  | ❌ | ❌ | ✅  |

## Tips for Future Migration

1. **Always check GAS first** — Open the corresponding `js_*.html` file and study the DOM structure
2. **Port CSS verbatim** — Don't "improve" CSS during migration; match it exactly
3. **Test with real data** — Use mock-data.ts entries that mirror real customer data
4. **Multi-page splitting** — `generateDocPages()` in GAS not yet ported (future task)
5. **PDF generation** — Currently uses print-to-PDF; consider html2pdf.js for true PDF
