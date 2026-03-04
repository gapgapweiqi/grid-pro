# File Structure Reference — SvelteKit App

## Directory Tree

```
app/src/
├── lib/
│   ├── assets/              — Static assets (fonts, images)
│   ├── components/
│   │   ├── dashboard/
│   │   │   └── Dashboard.svelte     — KPI cards, quick actions, low stock alert
│   │   ├── documents/
│   │   │   ├── DocPreview.svelte    — A4 document preview (ported from GAS)
│   │   │   └── PreviewModal.svelte  — Modal wrapper: zoom, print, close
│   │   └── layout/
│   │       ├── Sidebar.svelte       — Collapsible sidebar navigation
│   │       ├── Topbar.svelte        — Top bar with company switcher
│   │       ├── BottomNav.svelte     — Mobile bottom nav
│   │       └── Toast.svelte         — Toast notification system
│   ├── config/
│   │   └── constants.ts     — DOC_TYPES, DOC_CONFIG, DOC_LABELS, getDocConfig(), getDocTitle()
│   ├── db/
│   │   └── schema.ts        — DB schema definitions (for Phase 2 D1)
│   ├── services/
│   │   ├── api.ts            — API bridge (mock ↔ future backend)
│   │   ├── memory-adapter.ts — In-memory data adapter (current)
│   │   ├── mock-data.ts      — Mock companies, customers, products, salespersons, docs
│   │   ├── storage-adapter.ts— LocalStorage adapter
│   │   └── sync.ts           — Sync service (Phase 2)
│   ├── stores/
│   │   └── app.ts            — Svelte stores: sidebar, company, theme, toasts
│   ├── types/
│   │   └── index.ts          — All TypeScript types (Company, Customer, DocType, etc.)
│   └── utils/
│       ├── calc.ts           — calculateDocument(): VAT, WHT, discounts, custom fee
│       ├── csv.ts            — CSV import/export helpers
│       ├── format.ts         — formatMoney, formatDate, formatTaxId, formatPhone, bahtText
│       ├── helpers.ts        — roundMoney, generateUuid, nowIso, debounce
│       └── sequence.ts       — generateDocNo: document number generation
├── routes/
│   ├── +layout.svelte        — App shell: sidebar + topbar + content
│   ├── +layout.ts            — ssr=false, prerender=false (SPA mode)
│   ├── +page.svelte          — Dashboard (home page)
│   ├── companies/+page.svelte
│   ├── customers/+page.svelte
│   ├── documents/
│   │   ├── +page.svelte      — Document create/edit form + preview modal
│   │   └── history/+page.svelte — Document history list
│   ├── payments/+page.svelte
│   ├── products/+page.svelte
│   ├── salespersons/+page.svelte
│   └── settings/+page.svelte
└── app.css                    — Global styles + TailwindCSS
```

## Key Files Explained

### `lib/config/constants.ts`
Central configuration for all document types:
- **`DOC_TYPES`** — Array of `{ id, labelTh, labelEn }` for all 10 doc types
- **`DOC_CONFIG`** — Per-doctype config: `showDueDate`, `showValidUntil`, `showVendor`, `showPaymentTerms`, `showTermsAndConditions`, `showBankInfo`, `color`, `nameEN`, `itemColumns`
- **`DOC_LABELS`** — Thai/English labels for every field in the document preview
- **`getDocConfig(docType)`** — Returns config for a specific doc type
- **`getDocTitle(lang, docType)`** — Returns localized doc type title

### `lib/utils/calc.ts`
Document calculation engine:
- Input: line items, discount, VAT, WHT, custom fee toggles
- Output: `CalcResult` — subtotal, itemDiscountTotal, afterItemDiscount, discount, totalBeforeTax, vatAmount, whtAmount, customFeeAmount, grandTotal, lineTotals[]
- Supports: per-item discount (AMOUNT/PERCENT), global discount, VAT inclusive mode, WHT, custom fee

### `lib/components/documents/DocPreview.svelte`
A4 document preview component ported from GAS `js_preview.html`:
- Full HTML/CSS replication of GAS preview
- Sections: header (logo + company), parties, items table, summary (terms/bank + totals), amount words bar, payment terms, signatures, notes
- Dynamic columns and conditional rendering based on `DOC_CONFIG`

### `lib/components/documents/PreviewModal.svelte`
Modal wrapper for DocPreview:
- Zoom in/out/fit controls
- Print button (opens new window with print-ready HTML)
- Escape key to close
- Responsive (full-screen on mobile)

### `routes/documents/+page.svelte`
Document create/edit form with all GAS fields:
- Doc type selector, auto-generated doc number
- Customer/vendor selector, salesperson dropdown, contact person
- Line items with per-line discount
- Financial toggles: global discount, VAT (with inclusive mode), WHT, custom fee
- Signature name/date, payment terms presets
- Notes and terms/conditions
- Live summary panel (right side)
- Preview modal popup

## Document Types

| ID    | Thai Label          | English Label        |
|-------|--------------------|-----------------------|
| QUO   | ใบเสนอราคา          | Quotation             |
| INV   | ใบแจ้งหนี้           | Invoice               |
| RCPT  | ใบเสร็จรับเงิน       | Receipt               |
| TAX   | ใบกำกับภาษี         | Tax Invoice           |
| TAXR  | ใบกำกับภาษี/ใบเสร็จ  | Tax Invoice / Receipt |
| DN    | ใบส่งของ            | Delivery Note         |
| CN    | ใบลดหนี้            | Credit Note           |
| DBN   | ใบเพิ่มหนี้          | Debit Note            |
| PO    | ใบสั่งซื้อ           | Purchase Order        |
| BIL   | ใบวางบิล            | Billing Note          |
