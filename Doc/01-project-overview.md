# Project Overview — โปรแกรมออกเอกสาร

## วัตถุประสงค์
ระบบออกเอกสารธุรกิจ (ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ, ใบวางบิล ฯลฯ) สำหรับธุรกิจไทย
รองรับหลายบริษัท, คำนวณ VAT/WHT, พรีวิว A4, พิมพ์/PDF

## สถาปัตยกรรมโปรเจกต์

```
Project_โปรแกรมออกเอกสาร/
├── gas/            ← GAS Legacy (Google Apps Script) — ต้นฉบับ
├── product/        ← GAS Product wrapper (thin wrapper calls gas/ as Library)
├── app/            ← SvelteKit App — ตัวใหม่ที่กำลัง migrate
├── src-tauri/      ← Tauri desktop wrapper (Phase 5 — อนาคต)
└── Doc/            ← เอกสารโปรเจกต์ (คุณอยู่ตรงนี้)
```

## Tech Stack — SvelteKit App (`app/`)

| Layer          | Technology                                    |
|----------------|-----------------------------------------------|
| Framework      | SvelteKit 5 + TypeScript                      |
| Styling        | TailwindCSS v4 + Sarabun font                 |
| Icons          | Lucide Svelte                                 |
| Build          | Vite + adapter-static (SPA)                   |
| Data           | In-memory mock → Cloudflare D1 (Phase 2)      |
| Auth           | Mock → Google/LINE OAuth (Phase 2)            |
| Desktop        | Tauri (Phase 5)                                |

## GAS Legacy (`gas/`)

| Component       | Description                                   |
|-----------------|-----------------------------------------------|
| Backend (.gs)   | Api.gs, Repo.gs, DocumentService.gs ฯลฯ      |
| Frontend (HTML) | index.html + js_*.html modular files          |
| CSS             | app_css.html (~52K lines)                     |
| Library ID      | `1a1KBGcUBQMh8-...` (symbol `Lib` in product)|

### สิ่งสำคัญ
- `app_js.html` = monolithic bundle (3,167 lines) — **ห้าม** include พร้อม `js_*.html`
- `google.script.run` เรียกได้เฉพาะ top-level functions ใน Product
- ทุก API function ใหม่ต้องเพิ่มทั้งใน `gas/Api.gs` **และ** `product/Code.gs`

## Phases

| Phase | Description                        | Status        |
|-------|------------------------------------|---------------|
| 1     | SvelteKit scaffold + pages + mock  | ✅ Complete    |
| 2     | Cloudflare D1 + Workers backend    | ⏳ Planned     |
| 3     | Google/LINE auth + RBAC            | ⏳ Planned     |
| 4     | PWA + IndexedDB offline            | ⏳ Planned     |
| 5     | Tauri desktop                      | ⏳ Planned     |
| 6     | Google Drive file sync             | ⏳ Planned     |
