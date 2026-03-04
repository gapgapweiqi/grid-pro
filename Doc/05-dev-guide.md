# Developer Guide — วิธีพัฒนาและรันโปรเจกต์

## Prerequisites

| Tool     | Version  | Notes                    |
|----------|----------|--------------------------|
| Node.js  | ≥ 22.x   | `node -v`               |
| npm      | ≥ 10.x   | มากับ Node               |
| Bun      | optional  | ใช้แทน npm ได้           |

## Quick Start

```bash
# 1. ไปที่โฟลเดอร์ app
cd Project_โปรแกรมออกเอกสาร/app

# 2. ติดตั้ง dependencies
npm install

# 3. รัน dev server
npm run dev
# → http://localhost:5173

# 4. Type check
npx svelte-check --threshold error

# 5. Build for production
npm run build
# → output ที่ build/
```

## Project Commands

| Command               | Description                        |
|-----------------------|------------------------------------|
| `npm run dev`         | Start Vite dev server (port 5173)  |
| `npm run build`       | Production build → `build/`        |
| `npm run preview`     | Preview production build locally   |
| `npx svelte-check`   | TypeScript + Svelte diagnostics    |

## Code Conventions

### File Naming
- Components: `PascalCase.svelte` (e.g. `DocPreview.svelte`)
- Routes: `+page.svelte`, `+layout.svelte` (SvelteKit convention)
- Utils/Services: `kebab-case.ts` (e.g. `mock-data.ts`)
- Types: `index.ts` in `lib/types/`
- Config: `constants.ts` in `lib/config/`

### Svelte 5 Patterns
```svelte
<!-- State -->
let count = $state(0);

<!-- Derived -->
let doubled = $derived(count * 2);

<!-- Props -->
let { name, age = 0 }: { name: string; age?: number } = $props();

<!-- Effects (rare — prefer derived) -->
$effect(() => { console.log(count); });
```

### Styling
- TailwindCSS v4 for utility classes
- Inline `style=""` for one-off dynamic styles
- `<style>` block for component-scoped CSS
- Sarabun font (Thai) loaded via Google Fonts

### Document Preview CSS
- All doc preview CSS classes are in `DocPreview.svelte <style>` block
- Class names match GAS exactly: `.doc-header`, `.doc-parties`, `.doc-items-table`, etc.
- Theme color via CSS variable `--doc-accent`

## Adding a New Document Type

1. Add entry to `DOC_TYPES` array in `lib/config/constants.ts`
2. Add config to `DOC_CONFIG` object (visibility flags, color, columns)
3. Add labels to `DOC_LABELS.th` and `DOC_LABELS.en`
4. Update `DocType` union type in `lib/types/index.ts`
5. Test: create doc → preview → print

## Adding a New Page/Route

1. Create `src/routes/your-page/+page.svelte`
2. Add nav item to `Sidebar.svelte` (import icon from lucide-svelte)
3. Page loads data in `onMount()` via `api.*` methods
4. Use `$currentCompanyId` store for company context

## API Layer

Current architecture uses in-memory mock data (`memory-adapter.ts`).
The `api.ts` service provides a unified interface:

```typescript
// Example
const customers = await api.listCustomers(companyId);
const result = await api.upsertDoc(header, lines);
```

For Phase 2, swap `memory-adapter.ts` → Cloudflare D1 adapter.
The `api.ts` interface stays the same.

## Mock Data

Edit `lib/services/mock-data.ts` to add/modify test data:
- `MOCK_COMPANIES` — 2 companies
- `MOCK_CUSTOMERS` — sample customers per company
- `MOCK_PRODUCTS` — sample products with prices
- `MOCK_SALESPERSONS` — sample salespersons
- `MOCK_DOCUMENTS` — sample documents with lines

## Troubleshooting

### `svelte-check` shows a11y warnings
These are non-blocking accessibility warnings (e.g. "label must be associated with control").
They exist in several pages. Fix by adding `id` to inputs and `for` to labels.

### Preview modal doesn't show content
Check that `DocPreview.svelte` receives valid `calc` prop.
The `calc` must be a `CalcResult` object from `calculateDocument()`.

### Dev server port already in use
```bash
lsof -i :5173  # find PID
kill -9 <PID>  # kill it
npm run dev    # restart
```
