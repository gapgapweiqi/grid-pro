# Refactoring Progress Tracker

## Phase 1: SvelteKit Scaffold + Pages + Mock Data

### Core Structure
| #  | Task                                      | Status | Notes                              |
|----|-------------------------------------------|--------|------------------------------------|
| 1  | Project scaffolding (SvelteKit + TW + TS) | ✅     | adapter-static, SPA mode           |
| 2  | TypeScript types (`lib/types/index.ts`)   | ✅     | All entity + document types        |
| 3  | Config constants (`lib/config/constants.ts`) | ✅  | DOC_TYPES, DOC_CONFIG, DOC_LABELS  |
| 4  | Utility functions                          | ✅     | calc, format, helpers, sequence, csv |
| 5  | Mock data + in-memory adapter             | ✅     | Companies, customers, products, salespersons, docs |
| 6  | API service bridge                         | ✅     | Mock now, swappable for D1 later   |
| 7  | Svelte stores                              | ✅     | Sidebar, company, theme, toasts    |

### Layout Components
| #  | Task                     | Status | Notes                     |
|----|--------------------------|--------|---------------------------|
| 8  | Sidebar.svelte           | ✅     | Collapsible, mobile-ready |
| 9  | Topbar.svelte            | ✅     | Company switcher          |
| 10 | BottomNav.svelte         | ✅     | Mobile bottom bar         |
| 11 | Toast.svelte             | ✅     | Notification system       |

### Pages
| #  | Task                            | Status | Notes                          |
|----|---------------------------------|--------|--------------------------------|
| 12 | Dashboard (`/`)                 | ✅     | KPI cards per role             |
| 13 | Documents (`/documents`)        | ✅     | Full form + preview modal      |
| 14 | Doc History (`/documents/history`) | ✅  | List with filters              |
| 15 | Products (`/products`)          | ✅     | Table + modal CRUD             |
| 16 | Customers (`/customers`)        | ✅     | Table + modal CRUD             |
| 17 | Salespersons (`/salespersons`)  | ✅     | Table + modal CRUD             |
| 18 | Companies (`/companies`)        | ✅     | Multi-company management       |
| 19 | Payments (`/payments`)          | ✅     | Payment tracking               |
| 20 | Settings (`/settings`)          | ✅     | Basic settings page            |

### Document System (GAS Parity)
| #  | Task                                   | Status | Notes                                |
|----|----------------------------------------|--------|--------------------------------------|
| 21 | DOC_CONFIG + DOC_LABELS constants      | ✅     | 10 doc types, Thai/English labels    |
| 22 | DocPreview.svelte (A4 preview)         | ✅     | Full GAS parity: header, parties, items, totals, signatures |
| 23 | PreviewModal.svelte                    | ✅     | Zoom, print, ESC close              |
| 24 | Document form (all GAS fields)         | ✅     | Salesperson, per-line discount, VAT inclusive, custom fee, payment terms, signatures |
| 25 | calculateDocument() engine             | ✅     | Per-item discount, global discount, VAT, WHT, custom fee |
| 26 | Document number generation             | ✅     | sequence.ts — auto-increment, collision-free |

### Stock & Inventory Management
| #  | Task                                   | Status | Notes                              |
|----|----------------------------------------|--------|------------------------------------|
| 27 | Product purchasePrice field            | ✅     | ราคาซื้อ/ราคาขาย in form + table  |
| 28 | Stock KPI cards on products page       | ✅     | Total, value, enabled, low stock   |
| 29 | Product filters (category, stock)      | ✅     | Dropdown + stock status filter     |
| 30 | Purchases page (`/purchases`)          | ✅     | Stock-in form + recent logs        |
| 31 | PO from purchases → documents          | ✅     | Auto-fill PO doc type + lines      |
| 32 | Auto stock deduction on DO             | ✅     | Delivery Order deducts stock       |

### Dashboard Enhancements
| #  | Task                                   | Status | Notes                              |
|----|----------------------------------------|--------|------------------------------------|
| 33 | Custom date range picker               | ✅     | กำหนดเอง with from/to dates        |
| 34 | Stock section on dashboard             | ✅     | KPI + low stock alerts             |

### Document Templates
| #  | Task                                   | Status | Notes                              |
|----|----------------------------------------|--------|------------------------------------|
| 35 | Classic template overhaul              | ✅     | Double border, formal style        |
| 36 | 4 templates: Standard/Modern/Minimal/Classic | ✅ | All working in settings + preview  |

### SaaS Infrastructure
| #  | Task                                   | Status | Notes                              |
|----|----------------------------------------|--------|------------------------------------|
| 37 | Pricing config (`pricing.ts`)          | ✅     | 3 plans: Free/Pro/Enterprise       |
| 38 | Pricing page (`/pricing`)              | ✅     | Billing toggle, FAQ accordion      |
| 39 | Landing page (`/landing`)              | ✅     | Hero, features, platforms, CTA     |
| 40 | Login page (`/login`)                  | ✅     | Google/LINE/Email mock auth        |

### Still TODO for Phase 1
| #  | Task                                   | Status | Priority |
|----|----------------------------------------|--------|----------|
| 41 | Multi-page splitting (generateDocPages)| ⏳     | Medium   |
| 42 | CSV import/export UI                   | ⏳     | Low      |
| 43 | Document edit/view flow (from history) | ⏳     | Medium   |
| 44 | PDF export (html2pdf.js or similar)    | ⏳     | Low      |

---

## Phase 2: Cloudflare D1 + Workers Backend
| Task                         | Status |
|------------------------------|--------|
| D1 database schema           | ⏳     |
| Workers API endpoints        | ⏳     |
| Swap memory-adapter → D1     | ⏳     |
| Data migration tooling       | ⏳     |

## Phase 3: Authentication
| Task                         | Status |
|------------------------------|--------|
| Google OAuth                 | ⏳     |
| LINE Login                   | ⏳     |
| RBAC (admin/sales/accountant)| ⏳     |

## Phase 4: PWA + Offline
| Task                         | Status |
|------------------------------|--------|
| Service Worker               | ⏳     |
| IndexedDB cache              | ⏳     |
| Offline queue + sync         | ⏳     |

## Phase 5: Tauri Desktop
| Task                         | Status |
|------------------------------|--------|
| Tauri wrapper setup          | ⏳     |
| Native print integration     | ⏳     |
| Auto-update                  | ⏳     |

## Phase 6: Google Drive Sync
| Task                         | Status |
|------------------------------|--------|
| Drive API integration        | ⏳     |
| File backup/restore          | ⏳     |
| Shared company data          | ⏳     |

---

*Last updated: 2025-02-23*
