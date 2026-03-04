export interface TourStep {
  /** CSS selector to highlight (null = center dialog, no highlight) */
  selector: string | null;
  /** Title of the step */
  title: string;
  /** Description text */
  desc: string;
  /** Preferred tooltip position relative to the target */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Emoji icon shown before title */
  emoji?: string;
  /** Navigate to this path before showing this step (cross-page) */
  navigateTo?: string;
}

export interface TourConfig {
  id: string;
  /** Page path pattern (used to auto-trigger) */
  path: string;
  /** Tour title shown in welcome step */
  title: string;
  steps: TourStep[];
}

/** Ordered sequence of tour IDs for the full seamless tour */
export const TOUR_SEQUENCE = [
  'dashboard',
  'documents',
  'documents-history',
  'payments',
  'products',
  'purchases',
  'customers',
  'salespersons',
  'companies',
  'settings',
] as const;

export const TOURS: Record<string, TourConfig> = {
  /* ──────────────── แดชบอร์ด ──────────────── */
  dashboard: {
    id: 'dashboard',
    path: '/dashboard',
    title: 'แดชบอร์ด',
    steps: [
      { selector: null, title: 'ยินดีต้อนรับสู่ Grid Doc', emoji: '👋', desc: 'ระบบจัดการเอกสารธุรกิจครบวงจร — มาทำความรู้จักทีละขั้นตอนกันเลย!', position: 'bottom' },
      { selector: '[data-tour="sidebar-nav"]', title: 'เมนูหลัก', emoji: '📌', desc: 'เมนูด้านซ้ายพาไปทุกส่วน: ออกเอกสาร, สินค้า, ลูกค้า, ตั้งค่า ฯลฯ', position: 'right' },
      { selector: '[data-tour="range-bar"]', title: 'เลือกช่วงเวลา', emoji: '📅', desc: 'เลือกดูข้อมูลตามช่วงเวลาที่ต้องการ เช่น วันนี้ สัปดาห์นี้ เดือนนี้ หรือกำหนดเอง', position: 'bottom' },
      { selector: '[data-tour="kpi-toggle"]', title: 'สลับรายรับ / รายจ่าย', emoji: '🔄', desc: 'กดปุ่มนี้เพื่อสลับดูยอดรายรับ หรือยอดรายจ่ายของธุรกิจ', position: 'bottom' },
      { selector: '[data-tour="kpi-grid"]', title: 'ตัวเลข KPI สำคัญ', emoji: '📊', desc: 'ดูยอดขาย ยอดชำระแล้ว ค้างชำระ และ VAT — ข้อมูลอัปเดตตามช่วงเวลาที่เลือก', position: 'bottom' },
      { selector: '[data-tour="chart-section"]', title: 'กราฟแนวโน้มและลูกค้า', emoji: '📈', desc: 'ดูแนวโน้มยอดขาย 6 เดือนย้อนหลัง และลูกค้ายอดนิยม', position: 'top' },
      { selector: '[data-tour="unpaid-section"]', title: 'สินค้ายอดนิยม & ค้างชำระ', emoji: '⚡', desc: 'ดูสินค้าขายดี เอกสารที่ยังไม่ชำระ และ Flow การทำเอกสารต่อเนื่อง', position: 'top' },
      { selector: null, title: 'พร้อมไปหน้าถัดไป!', emoji: '🚀', desc: 'มาดูวิธีออกเอกสารธุรกิจกัน — กดถัดไปเพื่อไปหน้า "ออกเอกสาร"', position: 'bottom' },
    ],
  },

  /* ──────────────── ออกเอกสาร ──────────────── */
  documents: {
    id: 'documents',
    path: '/documents',
    title: 'ออกเอกสาร',
    steps: [
      { selector: null, title: 'หน้าออกเอกสาร', emoji: '📝', desc: 'สร้างเอกสารธุรกิจ 10+ ประเภท: ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ, ใบกำกับภาษี ฯลฯ', position: 'bottom', navigateTo: '/documents' },
      { selector: '[data-tour="step-indicator"]', title: 'ขั้นตอนการทำเอกสาร', emoji: '🔢', desc: 'ระบบแบ่งเป็น 3 ขั้นตอน: กรอกข้อมูล → เพิ่มรายการ → พรีวิว/บันทึก ง่ายมาก!', position: 'bottom' },
      { selector: '[data-tour="doc-info-card"]', title: 'ข้อมูลเอกสาร', emoji: '📋', desc: 'เลือกประเภทเอกสาร (รายรับ/รายจ่าย), กรอกเลขที่เอกสาร, วันที่, กำหนดชำระ', position: 'bottom' },
      { selector: '[data-tour="customer-card"]', title: 'ข้อมูลลูกค้า', emoji: '👤', desc: 'เลือกลูกค้าจากรายการ หรือกรอกข้อมูลใหม่: ชื่อ, เลขผู้เสียภาษี, ที่อยู่, เบอร์โทร', position: 'top' },
      { selector: '[data-tour="line-items"]', title: 'รายการสินค้า/บริการ', emoji: '🛒', desc: 'เพิ่มรายการ: เลือกสินค้า กรอกจำนวน ราคา ส่วนลด — ระบบคำนวณ VAT อัตโนมัติ', position: 'top' },
      { selector: null, title: 'พร้อมไปหน้าถัดไป!', emoji: '📄', desc: 'ดูประวัติเอกสารที่สร้างไว้ — กดถัดไปเพื่อไปหน้า "ประวัติเอกสาร"', position: 'bottom' },
    ],
  },

  /* ──────────────── ประวัติเอกสาร ──────────────── */
  'documents-history': {
    id: 'documents-history',
    path: '/documents/history',
    title: 'ประวัติเอกสาร',
    steps: [
      { selector: null, title: 'ประวัติเอกสารทั้งหมด', emoji: '🗂️', desc: 'ดูเอกสารทั้งหมดที่เคยสร้าง — ค้นหา กรอง พิมพ์ ดาวน์โหลด PDF ได้ทันที', position: 'bottom', navigateTo: '/documents/history' },
      { selector: '[data-tour="search-input"]', title: 'ค้นหาเอกสาร', emoji: '🔍', desc: 'พิมพ์เลขเอกสาร หรือชื่อลูกค้า เพื่อค้นหาเอกสารที่ต้องการอย่างรวดเร็ว', position: 'bottom' },
      { selector: '[data-tour="filter-section"]', title: 'กรองประเภท & สถานะ', emoji: '🏷️', desc: 'เลือกกรองตามประเภทเอกสาร (ใบเสนอราคา, ใบเสร็จ ฯลฯ) และสถานะการชำระเงิน', position: 'bottom' },
      { selector: '[data-tour="doc-table"]', title: 'ตารางเอกสาร', emoji: '📋', desc: 'กดที่เลขเอกสารเพื่อเปิดแก้ไข เปลี่ยนประเภท ลบ หรือพิมพ์/ดาวน์โหลด PDF ทีละรายการ', position: 'top' },
      { selector: null, title: 'ไปดูการชำระเงิน!', emoji: '💳', desc: 'มาดูวิธีติดตามการชำระเงิน — กดถัดไปเพื่อไปหน้า "ชำระเงิน"', position: 'bottom' },
    ],
  },

  /* ──────────────── ชำระเงิน ──────────────── */
  payments: {
    id: 'payments',
    path: '/payments',
    title: 'ติดตามชำระเงิน',
    steps: [
      { selector: null, title: 'ติดตามการชำระเงิน', emoji: '💰', desc: 'ดูสถานะการชำระเงินทุกเอกสาร — แยกชัดว่ารายไหนค้าง รายไหนจ่ายแล้ว', position: 'bottom', navigateTo: '/payments' },
      { selector: '[data-tour="payment-kpi"]', title: 'สรุปยอดชำระ', emoji: '📊', desc: 'ดูยอดค้างชำระ ชำระบางส่วน และชำระแล้ว — ดูภาพรวมได้ในพริบตา', position: 'bottom' },
      { selector: '[data-tour="payment-filters"]', title: 'ค้นหาและกรอง', emoji: '🔍', desc: 'ค้นหาด้วยเลขเอกสาร/ชื่อลูกค้า กรองตามประเภทและสถานะ', position: 'bottom' },
      { selector: '[data-tour="payment-list"]', title: 'เปลี่ยนสถานะชำระ', emoji: '✅', desc: 'กดเปลี่ยนสถานะจาก "ยังไม่ชำระ" เป็น "ชำระแล้ว" ได้ทันทีจากตาราง', position: 'top' },
      { selector: null, title: 'ไปดูสินค้า!', emoji: '📦', desc: 'มาดูวิธีจัดการสินค้า/บริการ — กดถัดไปเพื่อไปหน้า "สินค้า"', position: 'bottom' },
    ],
  },

  /* ──────────────── สินค้า/บริการ ──────────────── */
  products: {
    id: 'products',
    path: '/products',
    title: 'สินค้า/บริการ',
    steps: [
      { selector: null, title: 'จัดการสินค้า/บริการ', emoji: '📦', desc: 'เพิ่ม แก้ไข ลบ สินค้าและบริการ — พร้อมระบบสต๊อกอัตโนมัติ', position: 'bottom', navigateTo: '/products' },
      { selector: '[data-tour="product-kpi"]', title: 'สรุปสินค้า', emoji: '📊', desc: 'ดูจำนวนสินค้าทั้งหมด, บริการ, มูลค่าสต๊อก และสินค้าที่สต๊อกต่ำ', position: 'bottom' },
      { selector: '[data-tour="product-search"]', title: 'ค้นหาสินค้า', emoji: '🔍', desc: 'พิมพ์ชื่อ รหัส หรือหมวดหมู่ เพื่อค้นหาสินค้าได้รวดเร็ว', position: 'bottom' },
      { selector: '[data-tour="product-csv"]', title: 'ส่งออก / นำเข้า CSV', emoji: '📥', desc: 'ส่งออกสินค้าเป็นไฟล์ CSV หรือนำเข้าจากไฟล์ CSV ได้ทันที', position: 'bottom' },
      { selector: '[data-tour="product-filter"]', title: 'กรองสินค้า', emoji: '🏷️', desc: 'กรองตามหมวดหมู่ สถานะสต๊อก หรือประเภท (สินค้า/บริการ)', position: 'bottom' },
      { selector: '[data-tour="product-table"]', title: 'ตารางสินค้า', emoji: '📋', desc: 'กดที่ชื่อสินค้าเพื่อแก้ไข เปิด/ปิดสต๊อก ปรับราคา หรือลบ', position: 'top' },
      { selector: null, title: 'ไปดูการสั่งซื้อ!', emoji: '🛒', desc: 'มาดูวิธีสั่งซื้อสินค้าเข้าสต๊อก — กดถัดไปเพื่อไปหน้า "สั่งซื้อ"', position: 'bottom' },
    ],
  },

  /* ──────────────── สั่งซื้อสินค้า ──────────────── */
  purchases: {
    id: 'purchases',
    path: '/purchases',
    title: 'สั่งซื้อสินค้า',
    steps: [
      { selector: null, title: 'สั่งซื้อ / รับเข้าสต๊อก', emoji: '🛒', desc: 'สั่งซื้อสินค้าจากผู้ขาย → สินค้าจะเพิ่มเข้าคลังสต๊อกอัตโนมัติ', position: 'bottom', navigateTo: '/purchases' },
      { selector: '[data-tour="purchase-supplier"]', title: 'ข้อมูลการสั่งซื้อ', emoji: '📋', desc: 'กรอกวันที่ เลขอ้างอิง เลือกผู้ขาย และหมายเหตุ', position: 'bottom' },
      { selector: '[data-tour="purchase-lines"]', title: 'เลือกสินค้าที่จะสั่ง', emoji: '📦', desc: 'เลือกสินค้าจากรายการ กรอกจำนวนและราคาต่อหน่วย — กด "รับเข้าสต๊อก" เมื่อเสร็จ', position: 'top' },
      { selector: null, title: 'ไปดูลูกค้า!', emoji: '👥', desc: 'มาดูวิธีจัดการลูกค้าและผู้ขาย — กดถัดไปเพื่อไปหน้า "ลูกค้า"', position: 'bottom' },
    ],
  },

  /* ──────────────── ลูกค้า/ผู้ขาย ──────────────── */
  customers: {
    id: 'customers',
    path: '/customers',
    title: 'ลูกค้า/ผู้ขาย',
    steps: [
      { selector: null, title: 'จัดการลูกค้า & ผู้ขาย', emoji: '👥', desc: 'เพิ่มข้อมูลลูกค้าและผู้ขาย เพื่อเรียกใช้ตอนออกเอกสารได้สะดวก', position: 'bottom', navigateTo: '/customers' },
      { selector: '[data-tour="customer-search"]', title: 'ค้นหาลูกค้า', emoji: '🔍', desc: 'พิมพ์ชื่อ รหัส เบอร์โทร หรืออีเมล เพื่อค้นหาลูกค้าได้ทันที', position: 'bottom' },
      { selector: '[data-tour="customer-csv"]', title: 'ส่งออก / นำเข้า CSV', emoji: '📥', desc: 'ส่งออกรายชื่อลูกค้า หรือนำเข้าจากไฟล์ CSV', position: 'bottom' },
      { selector: '[data-tour="customer-table"]', title: 'ตารางลูกค้า', emoji: '📋', desc: 'กดที่ลูกค้าเพื่อแก้ไขข้อมูล ดูเลขผู้เสียภาษี เบอร์โทร อีเมล ฯลฯ', position: 'top' },
      { selector: null, title: 'ไปดูพนักงานขาย!', emoji: '🧑‍💼', desc: 'มาดูวิธีจัดการพนักงานขาย — กดถัดไปเพื่อไปหน้า "พนักงานขาย"', position: 'bottom' },
    ],
  },

  /* ──────────────── พนักงานขาย ──────────────── */
  salespersons: {
    id: 'salespersons',
    path: '/salespersons',
    title: 'พนักงานขาย',
    steps: [
      { selector: null, title: 'จัดการพนักงานขาย', emoji: '🧑‍💼', desc: 'เพิ่มพนักงานขายเพื่อระบุในเอกสาร — ใช้ติดตามยอดขายรายบุคคลได้', position: 'bottom', navigateTo: '/salespersons' },
      { selector: '[data-tour="sp-search"]', title: 'ค้นหาพนักงานขาย', emoji: '🔍', desc: 'พิมพ์ชื่อ ตำแหน่ง หรือเบอร์โทร เพื่อค้นหา', position: 'bottom' },
      { selector: '[data-tour="sp-table"]', title: 'ตารางพนักงานขาย', emoji: '📋', desc: 'ดูรายชื่อ ตำแหน่ง เบอร์โทร อีเมล — กดแก้ไขหรือลบได้เลย', position: 'top' },
      { selector: null, title: 'ไปดูบริษัท!', emoji: '🏢', desc: 'มาตั้งค่าข้อมูลบริษัทกัน — กดถัดไปเพื่อไปหน้า "บริษัท"', position: 'bottom' },
    ],
  },

  /* ──────────────── บริษัท ──────────────── */
  companies: {
    id: 'companies',
    path: '/companies',
    title: 'บริษัทของฉัน',
    steps: [
      { selector: null, title: 'ตั้งค่าบริษัท', emoji: '🏢', desc: 'ตั้งค่าข้อมูลบริษัท โลโก้ ตราประทับ — สามารถเพิ่มหลายบริษัทและสลับได้', position: 'bottom', navigateTo: '/companies' },
      { selector: '[data-tour="company-list"]', title: 'รายการบริษัท', emoji: '📋', desc: 'กดที่การ์ดบริษัทเพื่อแก้ไขชื่อ ที่อยู่ เลขผู้เสียภาษี อัปโหลดโลโก้ และตราประทับ', position: 'top' },
      { selector: null, title: 'ไปตั้งค่าระบบ!', emoji: '⚙️', desc: 'มาปรับแต่งระบบให้เหมาะกับคุณ — กดถัดไปเพื่อไปหน้า "ตั้งค่า"', position: 'bottom' },
    ],
  },

  /* ──────────────── ตั้งค่า ──────────────── */
  settings: {
    id: 'settings',
    path: '/settings',
    title: 'ตั้งค่า',
    steps: [
      { selector: null, title: 'ตั้งค่าระบบ', emoji: '⚙️', desc: 'ปรับแต่งธีมสี ฟอนต์ รูปแบบเอกสาร เลขเอกสาร และค่าเริ่มต้นต่างๆ', position: 'bottom', navigateTo: '/settings' },
      { selector: '[data-tour="settings-tabs"]', title: 'แท็บตั้งค่า', emoji: '🗂️', desc: 'เลือกแท็บเพื่อปรับ: หน้าตา, สีเอกสาร, รูปแบบเอกสาร, เลขเอกสาร, ค่าเริ่มต้น', position: 'bottom' },
      { selector: null, title: 'ทัวร์เสร็จสมบูรณ์!', emoji: '🎉', desc: 'คุณได้เรียนรู้ทุกส่วนของ Grid Doc แล้ว — พร้อมใช้งานจริงได้เลย! หากต้องการดูทัวร์อีกครั้ง กดที่เมนู Admin', position: 'bottom' },
    ],
  },

  /* ──────────────── Sandbox ──────────────── */
  sandbox: {
    id: 'sandbox',
    path: '/sandbox',
    title: 'โหมด Sandbox',
    steps: [
      { selector: null, title: 'ยินดีต้อนรับสู่ Sandbox!', emoji: '🎯', desc: 'นี่คือโหมดทดลองใช้งาน — ข้อมูลทั้งหมดเป็นตัวอย่าง ลองใช้ได้อย่างสบายใจ', position: 'bottom' },
      { selector: '[data-tour="sidebar-nav"]', title: 'ลองใช้ทุกเมนู', emoji: '📌', desc: 'ลองกดเมนูด้านซ้ายเพื่อทดลอง: ออกเอกสาร, สินค้า, ลูกค้า, ตั้งค่า', position: 'right' },
      { selector: null, title: 'พร้อมใช้จริง?', emoji: '🚀', desc: 'เมื่อพร้อมใช้งานจริง กดปุ่ม "เริ่มใช้งานจริง" ที่ด้านบน — สมัครง่าย ใช้เร็ว!', position: 'bottom' },
    ],
  },
};

/** Get tour config for a given path */
export function getTourForPath(path: string): TourConfig | null {
  // Exact match first
  for (const tour of Object.values(TOURS)) {
    if (path === tour.path) return tour;
  }
  // Prefix match (e.g., /documents/history)
  const sorted = Object.values(TOURS).sort((a, b) => b.path.length - a.path.length);
  for (const tour of sorted) {
    if (path.startsWith(tour.path) && tour.path !== '/') return tour;
  }
  return null;
}

/** Get the next tour in the sequence after the given tour ID */
export function getNextTourId(currentId: string): string | null {
  const idx = TOUR_SEQUENCE.indexOf(currentId as typeof TOUR_SEQUENCE[number]);
  if (idx === -1 || idx >= TOUR_SEQUENCE.length - 1) return null;
  return TOUR_SEQUENCE[idx + 1];
}

/** Get the tour index in the global sequence (1-based) */
export function getTourIndex(tourId: string): number {
  return TOUR_SEQUENCE.indexOf(tourId as typeof TOUR_SEQUENCE[number]) + 1;
}

/** Total number of tours in the sequence */
export const TOTAL_TOURS = TOUR_SEQUENCE.length;
