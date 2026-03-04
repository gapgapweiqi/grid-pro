import type { Company, Customer, Product, Salesperson, DocumentHeader, DocLine, KpiData, SalesTrendItem, TopCustomerItem, TopProductItem } from '$lib/types';
import { generateUuid, nowIso } from '$lib/utils/helpers';

const NOW = nowIso();

export const MOCK_COMPANIES: Company[] = [
  {
    entityId: 'comp-001',
    entityType: 'COMPANY',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'CO0001',
    name: 'บริษัท กริดโปร จำกัด',
    name2: 'GridPro Co., Ltd.',
    taxId: '0105566012345',
    phone: '0812345678',
    email: 'info@gridpro.co.th',
    address: '123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    tags: '',
    status: 'ACTIVE',
    isDeleted: false,
    json: {
      branchName: 'สำนักงานใหญ่',
      branchNo: '00000',
      vatRegistered: true,
      logo: '/gridpro-logo.jpg',
      bankAccounts: [
        { bankName: 'ธนาคารกสิกรไทย', accountName: 'บริษัท กริดโปร จำกัด', accountNo: '0123456789', branch: 'สาขาสุขุมวิท', qrCodeImage: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg' }
      ],
      signerName: 'นายสมชาย ใจดี',
      signerTitle: 'กรรมการผู้จัดการ'
    },
    createdAt: NOW,
    updatedAt: NOW
  }
];

export const MOCK_CUSTOMERS: Customer[] = [
  {
    entityId: 'cust-001',
    entityType: 'CUSTOMER',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'C0001',
    name: 'บริษัท เอบีซี จำกัด',
    name2: 'ABC Co., Ltd.',
    taxId: '0105566098765',
    phone: '0898765432',
    email: 'contact@abc.co.th',
    address: '456/78 ถ.พระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310',
    tags: '',
    status: 'ACTIVE',
    isDeleted: false,
    json: { creditTermDays: 30 },
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    entityId: 'cust-002',
    entityType: 'CUSTOMER',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'C0002',
    name: 'ห้างหุ้นส่วนจำกัด ดีเอฟจี',
    name2: 'DFG Limited Partnership',
    taxId: '0103560054321',
    phone: '0234567890',
    email: 'info@dfg.co.th',
    address: '789 ถ.รัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400',
    tags: '',
    status: 'ACTIVE',
    isDeleted: false,
    json: { creditTermDays: 15 },
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    entityId: 'cust-003',
    entityType: 'CUSTOMER',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'C0003',
    name: 'นายธนกฤต วงศ์สวัสดิ์',
    name2: '',
    taxId: '1100100123456',
    phone: '0654321098',
    email: 'thanakrit@gmail.com',
    address: '12/3 หมู่ 5 ต.บางพลี อ.บางพลี จ.สมุทรปราการ 10540',
    tags: '',
    status: 'ACTIVE',
    isDeleted: false,
    json: {},
    createdAt: NOW,
    updatedAt: NOW
  }
];

export const SANDBOX_LOCKED_PRODUCT_ID = 'sandbox-prod-gridpro';

export const MOCK_PRODUCTS: Product[] = [
  {
    entityId: SANDBOX_LOCKED_PRODUCT_ID,
    entityType: 'PRODUCT',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'GP001',
    name: 'โปรแกรมออกเอกสาร',
    name2: 'Document Program',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    tags: 'software',
    status: 'ACTIVE',
    isDeleted: false,
    json: { unit: 'License', price: 790, category: 'ซอฟต์แวร์' },
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    entityId: 'prod-001',
    entityType: 'PRODUCT',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'P0001',
    name: 'บริการออกแบบเว็บไซต์',
    name2: 'Website Design Service',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    tags: 'service',
    status: 'ACTIVE',
    isDeleted: false,
    json: { unit: 'งาน', price: 25000, category: 'บริการ' },
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    entityId: 'prod-002',
    entityType: 'PRODUCT',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'P0002',
    name: 'พัฒนาระบบ ERP',
    name2: 'ERP System Development',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    tags: 'service',
    status: 'ACTIVE',
    isDeleted: false,
    json: { unit: 'โปรเจกต์', price: 150000, category: 'บริการ' },
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    entityId: 'prod-003',
    entityType: 'PRODUCT',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'P0003',
    name: 'ค่าบำรุงรักษาระบบรายปี',
    name2: 'Annual Maintenance',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    tags: 'service',
    status: 'ACTIVE',
    isDeleted: false,
    json: { unit: 'ปี', price: 36000, category: 'บริการ' },
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    entityId: 'prod-004',
    entityType: 'PRODUCT',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'P0004',
    name: 'คอมพิวเตอร์โน๊ตบุ๊ค',
    name2: 'Laptop Computer',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    tags: 'product',
    status: 'ACTIVE',
    isDeleted: false,
    json: { unit: 'เครื่อง', price: 35000, purchasePrice: 28000, category: 'สินค้า', stockEnabled: true, stockQty: 3, stockLogs: [{ date: NOW.substring(0, 10), qty: 3, type: 'IN', reason: 'สต๊อกเริ่มต้น' }] },
    createdAt: NOW,
    updatedAt: NOW
  }
];

export const MOCK_SALESPERSONS: Salesperson[] = [
  {
    entityId: 'sp-001',
    entityType: 'SALESPERSON',
    userId: 'user-001',
    companyId: 'comp-001',
    code: 'SP0001',
    name: 'คุณสมศรี ขยันดี',
    name2: '',
    taxId: '',
    phone: '0812223333',
    email: 'somsri@gridpro.co.th',
    address: '',
    tags: '',
    status: 'ACTIVE',
    isDeleted: false,
    json: { position: 'พนักงานขายอาวุโส', department: 'ฝ่ายขาย' },
    createdAt: NOW,
    updatedAt: NOW
  }
];

function makeDoc(partial: Partial<DocumentHeader>): DocumentHeader {
  return {
    docId: generateUuid(),
    docType: 'INV',
    userId: 'user-001',
    companyId: 'comp-001',
    customerId: 'cust-001',
    docNo: '',
    docDate: new Date().toISOString().substring(0, 10),
    dueDate: '',
    refDocNo: '',
    refDocId: '',
    currency: 'THB',
    subtotal: 0,
    discountEnabled: false,
    discountType: 'AMOUNT',
    discountValue: 0,
    vatEnabled: true,
    vatRate: 7,
    whtEnabled: false,
    whtRate: 3,
    totalBeforeTax: 0,
    vatAmount: 0,
    whtAmount: 0,
    grandTotal: 0,
    paymentStatus: 'UNPAID',
    docStatus: 'ISSUED',
    notes: '',
    terms: '',
    signatureEnabled: true,
    pdfFileId: '',
    isDeleted: false,
    json: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...partial
  };
}

export const MOCK_DOCUMENTS: DocumentHeader[] = [
  makeDoc({
    docId: 'doc-001',
    docType: 'QUO',
    customerId: 'cust-001',
    docNo: 'QUO6902-0001',
    docDate: '2026-02-10',
    dueDate: '2026-03-10',
    subtotal: 25000,
    totalBeforeTax: 25000,
    vatAmount: 1750,
    grandTotal: 26750,
    paymentStatus: 'UNPAID',
    docStatus: 'ISSUED',
    json: { customerName: 'บริษัท เอบีซี จำกัด' }
  }),
  makeDoc({
    docId: 'doc-002',
    docType: 'INV',
    customerId: 'cust-001',
    docNo: 'INV6902-0001',
    docDate: '2026-02-15',
    dueDate: '2026-03-15',
    subtotal: 150000,
    totalBeforeTax: 150000,
    vatAmount: 10500,
    grandTotal: 160500,
    paymentStatus: 'UNPAID',
    docStatus: 'ISSUED',
    json: { customerName: 'บริษัท เอบีซี จำกัด' }
  }),
  makeDoc({
    docId: 'doc-003',
    docType: 'INV',
    customerId: 'cust-002',
    docNo: 'INV6902-0002',
    docDate: '2026-02-18',
    dueDate: '2026-03-18',
    subtotal: 36000,
    totalBeforeTax: 36000,
    vatAmount: 2520,
    grandTotal: 38520,
    paymentStatus: 'PAID',
    docStatus: 'ISSUED',
    json: { customerName: 'ห้างหุ้นส่วนจำกัด ดีเอฟจี' }
  }),
  makeDoc({
    docId: 'doc-004',
    docType: 'RCPT',
    customerId: 'cust-002',
    docNo: 'RCP6902-0001',
    docDate: '2026-02-20',
    subtotal: 36000,
    totalBeforeTax: 36000,
    vatAmount: 2520,
    grandTotal: 38520,
    paymentStatus: 'PAID',
    docStatus: 'ISSUED',
    json: { customerName: 'ห้างหุ้นส่วนจำกัด ดีเอฟจี' }
  }),
  makeDoc({
    docId: 'doc-005',
    docType: 'TAX',
    customerId: 'cust-003',
    docNo: 'TAX6901-0001',
    docDate: '2026-01-20',
    subtotal: 70000,
    totalBeforeTax: 70000,
    vatAmount: 4900,
    grandTotal: 74900,
    paymentStatus: 'PAID',
    docStatus: 'ISSUED',
    json: { customerName: 'นายธนกฤต วงศ์สวัสดิ์' }
  })
];

export const MOCK_DOC_LINES: DocLine[] = [
  {
    lineId: 'line-001',
    docId: 'doc-001',
    lineNo: 1,
    productId: 'prod-001',
    code: 'P0001',
    name: 'บริการออกแบบเว็บไซต์',
    description: 'ออกแบบ UI/UX พร้อมพัฒนา responsive',
    qty: 1,
    unit: 'งาน',
    unitPrice: 25000,
    discountType: '',
    discountValue: 0,
    lineTotal: 25000,
    json: {},
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    lineId: 'line-002',
    docId: 'doc-002',
    lineNo: 1,
    productId: 'prod-002',
    code: 'P0002',
    name: 'พัฒนาระบบ ERP',
    description: 'ระบบจัดการคลังสินค้า + ระบบขาย',
    qty: 1,
    unit: 'โปรเจกต์',
    unitPrice: 150000,
    discountType: '',
    discountValue: 0,
    lineTotal: 150000,
    json: {},
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    lineId: 'line-003',
    docId: 'doc-003',
    lineNo: 1,
    productId: 'prod-003',
    code: 'P0003',
    name: 'ค่าบำรุงรักษาระบบรายปี',
    description: '',
    qty: 1,
    unit: 'ปี',
    unitPrice: 36000,
    discountType: '',
    discountValue: 0,
    lineTotal: 36000,
    json: {},
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    lineId: 'line-004',
    docId: 'doc-004',
    lineNo: 1,
    productId: 'prod-003',
    code: 'P0003',
    name: 'ค่าบำรุงรักษาระบบรายปี',
    description: '',
    qty: 1,
    unit: 'ปี',
    unitPrice: 36000,
    discountType: '',
    discountValue: 0,
    lineTotal: 36000,
    json: {},
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    lineId: 'line-005a',
    docId: 'doc-005',
    lineNo: 1,
    productId: 'prod-004',
    code: 'P0004',
    name: 'คอมพิวเตอร์โน๊ตบุ๊ค',
    description: 'MacBook Air M3',
    qty: 2,
    unit: 'เครื่อง',
    unitPrice: 35000,
    discountType: '',
    discountValue: 0,
    lineTotal: 70000,
    json: {},
    createdAt: NOW,
    updatedAt: NOW
  }
];

export function getMockKpi(): KpiData {
  const docs = MOCK_DOCUMENTS.filter(d => !d.isDeleted);
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const period = months[now.getMonth()] + ' ' + String(now.getFullYear() + 543).substring(2);

  let salesThisMonth = 0, paidThisMonth = 0, unpaidTotal = 0, vatOutput = 0;
  let totalRevenue = 0;

  for (const d of docs) {
    totalRevenue += d.grandTotal;
    if (d.docType !== 'RCPT' && d.paymentStatus !== 'PAID') unpaidTotal += d.grandTotal;
    const ym = (d.docDate || '').substring(0, 7);
    if (ym === currentYM) {
      salesThisMonth += d.grandTotal;
      vatOutput += d.vatAmount;
      if (d.docType === 'RCPT' || d.paymentStatus === 'PAID') paidThisMonth += d.grandTotal;
    }
  }

  return {
    salesThisMonth: Math.round(salesThisMonth * 100) / 100,
    unpaidTotal: Math.round(unpaidTotal * 100) / 100,
    paidThisMonth: Math.round(paidThisMonth * 100) / 100,
    vatOutputThisMonth: Math.round(vatOutput * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalDocuments: docs.length,
    period
  };
}

export function getMockSalesTrend(): SalesTrendItem[] {
  const now = new Date();
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const result: SalesTrendItem[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = months[d.getMonth()] + ' ' + String(d.getFullYear() + 543).substring(2);
    let total = 0, count = 0;
    for (const doc of MOCK_DOCUMENTS) {
      if (!doc.isDeleted && (doc.docDate || '').substring(0, 7) === ym) {
        total += doc.grandTotal;
        count++;
      }
    }
    result.push({ month: label, label, total: Math.round(total * 100) / 100, sales: Math.round(total * 100) / 100, count });
  }
  return result;
}

export function getMockTopCustomers(): TopCustomerItem[] {
  const map: Record<string, TopCustomerItem> = {};
  for (const d of MOCK_DOCUMENTS) {
    if (d.isDeleted || !d.customerId) continue;
    const cname = (d.json as Record<string, string>)?.customerName || d.customerId;
    if (!map[d.customerId]) map[d.customerId] = { customerId: d.customerId, customerName: cname, total: 0, count: 0 };
    map[d.customerId].total += d.grandTotal;
    map[d.customerId].count++;
  }
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
}

export function getMockTopProducts(): TopProductItem[] {
  const map: Record<string, TopProductItem> = {};
  for (const l of MOCK_DOC_LINES) {
    const key = l.productId || l.name;
    if (!map[key]) map[key] = { productId: key, name: l.name, total: 0, qty: 0 };
    map[key].total += l.lineTotal;
    map[key].qty += l.qty;
  }
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
}
