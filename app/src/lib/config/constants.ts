import type { DocType, DocTypeInfo, DocTypeConfig, DocLang, FontOption, ThemeOption } from '$lib/types';

export const DOC_TYPES: DocTypeInfo[] = [
  { id: 'QUO', label: 'Quotation', labelTh: 'ใบเสนอราคา', category: 'sales' },
  { id: 'INV', label: 'Invoice', labelTh: 'ใบแจ้งหนี้', category: 'sales' },
  { id: 'BILL', label: 'Billing Note', labelTh: 'ใบวางบิล', category: 'sales' },
  { id: 'TAX', label: 'Tax Invoice', labelTh: 'ใบกำกับภาษี', category: 'sales' },
  { id: 'TAXRCPT', label: 'Receipt / Tax Invoice', labelTh: 'ใบเสร็จรับเงิน/ใบกำกับภาษี', category: 'sales' },
  { id: 'RCPT', label: 'Receipt', labelTh: 'ใบเสร็จรับเงิน', category: 'sales' },
  { id: 'DO', label: 'Delivery Order', labelTh: 'ใบส่งของ', category: 'sales' },
  { id: 'PO', label: 'Purchase Order', labelTh: 'ใบสั่งซื้อ', category: 'purchase' },
  { id: 'CN', label: 'Credit Note', labelTh: 'ใบลดหนี้', category: 'finance' },
  { id: 'PV', label: 'Payment Voucher', labelTh: 'ใบสำคัญจ่าย', category: 'finance' },
  { id: 'PR', label: 'Purchase Request', labelTh: 'ใบขอซื้อ', category: 'purchase' }
];

export const DOC_CONFIG: Record<DocType, DocTypeConfig> = {
  QUO: {
    code: 'QUO', nameTH: 'ใบเสนอราคา', nameEN: 'Quotation', prefix: 'QUO',
    itemsTitleTh: 'รายการสินค้า/บริการ', itemsTitleEn: 'Items / Services',
    showCustomer: true, showVendor: false, showShipTo: false, showValidUntil: true,
    showDueDate: false, showPaymentTerms: true, showTermsAndConditions: true, showSignature: true,
    showPaymentMethod: true,
    itemColumns: ['description', 'qty', 'unit', 'price', 'discount', 'amount'],
    color: '#1e40af' // Deep blue
  },
  INV: {
    code: 'INV', nameTH: 'ใบแจ้งหนี้', nameEN: 'Invoice', prefix: 'INV',
    itemsTitleTh: 'รายการสินค้า/บริการ', itemsTitleEn: 'Items / Services',
    showCustomer: true, showVendor: false, showShipTo: false, showValidUntil: false,
    showDueDate: true, showPaymentTerms: true, showTermsAndConditions: true, showSignature: false,
    showPaymentMethod: true,
    itemColumns: ['description', 'qty', 'unit', 'price', 'discount', 'amount'],
    color: '#3730a3' // Deep indigo
  },
  BILL: {
    code: 'BILL', nameTH: 'ใบวางบิล', nameEN: 'Billing Note', prefix: 'BN',
    itemsTitleTh: 'รายการใบแจ้งหนี้', itemsTitleEn: 'Invoice List',
    showCustomer: true, showVendor: false, showShipTo: false, showValidUntil: false,
    showDueDate: true, showPaymentTerms: true, showTermsAndConditions: true, showSignature: false,
    showPaymentMethod: true,
    itemColumns: ['docRef', 'docDate', 'dueDate', 'amount'],
    color: '#be185d' // Deep pink
  },
  TAX: {
    code: 'TAX', nameTH: 'ใบกำกับภาษี', nameEN: 'Tax Invoice', prefix: 'TAX',
    itemsTitleTh: 'รายการสินค้า/บริการ', itemsTitleEn: 'Items / Services',
    showCustomer: true, showVendor: false, showShipTo: false, showValidUntil: false,
    showDueDate: false, showPaymentTerms: false, showTermsAndConditions: true, showSignature: true,
    showPaymentMethod: true,
    itemColumns: ['description', 'qty', 'unit', 'price', 'amount'],
    color: '#c2410c' // Deep orange
  },
  TAXRCPT: {
    code: 'TAXRCPT', nameTH: 'ใบเสร็จรับเงิน/ใบกำกับภาษี', nameEN: 'Receipt / Tax Invoice', prefix: 'TAXRCPT',
    itemsTitleTh: 'รายการสินค้า/บริการ', itemsTitleEn: 'Items / Services',
    showCustomer: true, showVendor: false, showShipTo: false, showValidUntil: false,
    showDueDate: false, showPaymentTerms: false, showTermsAndConditions: true, showSignature: true,
    showPaymentMethod: true,
    itemColumns: ['description', 'qty', 'unit', 'price', 'discount', 'amount'],
    color: '#0f766e' // Deep teal
  },
  RCPT: {
    code: 'RCPT', nameTH: 'ใบเสร็จรับเงิน', nameEN: 'Receipt', prefix: 'RCP',
    itemsTitleTh: 'รายการสินค้า/บริการ', itemsTitleEn: 'Items / Services',
    showCustomer: true, showVendor: false, showShipTo: false, showValidUntil: false,
    showDueDate: false, showPaymentTerms: false, showTermsAndConditions: true, showSignature: true,
    showPaymentMethod: true,
    itemColumns: ['description', 'qty', 'unit', 'price', 'discount', 'amount'],
    color: '#166534' // Deep green
  },
  DO: {
    code: 'DO', nameTH: 'ใบส่งของ', nameEN: 'Delivery Order', prefix: 'DO',
    itemsTitleTh: 'รายการส่งของ', itemsTitleEn: 'Delivery Items',
    showCustomer: true, showVendor: false, showShipTo: true, showValidUntil: false,
    showDueDate: false, showPaymentTerms: false, showTermsAndConditions: true, showSignature: true,
    showDeliveryInfo: true,
    itemColumns: ['description', 'qty', 'unit'],
    color: '#6b21a8' // Deep purple
  },
  PO: {
    code: 'PO', nameTH: 'ใบสั่งซื้อ', nameEN: 'Purchase Order', prefix: 'PO',
    itemsTitleTh: 'รายการสั่งซื้อ', itemsTitleEn: 'Purchase Items',
    showCustomer: false, showVendor: true, showShipTo: true, showValidUntil: true,
    showDueDate: false, showPaymentTerms: true, showTermsAndConditions: true, showSignature: true,
    showPaymentMethod: true,
    showShippingTerms: true,
    itemColumns: ['description', 'qty', 'unit', 'price', 'discount', 'amount'],
    color: '#0369a1' // Deep sky
  },
  CN: {
    code: 'CN', nameTH: 'ใบลดหนี้', nameEN: 'Credit Note', prefix: 'CN',
    itemsTitleTh: 'รายการลดหนี้', itemsTitleEn: 'Credit Items',
    showCustomer: true, showVendor: false, showShipTo: false, showValidUntil: false,
    showDueDate: false, showPaymentTerms: false, showTermsAndConditions: true, showSignature: true,
    showRefDoc: true,
    itemColumns: ['description', 'qty', 'unit', 'price', 'amount'],
    color: '#b91c1c' // Deep red
  },
  PV: {
    code: 'PV', nameTH: 'ใบสำคัญจ่าย', nameEN: 'Payment Voucher', prefix: 'PV',
    itemsTitleTh: 'รายการจ่ายเงิน', itemsTitleEn: 'Payment Items',
    showCustomer: false, showVendor: true, showShipTo: false, showValidUntil: false,
    showDueDate: false, showPaymentTerms: false, showTermsAndConditions: true, showSignature: true,
    showPaymentMethod: true,
    itemColumns: ['description', 'amount'],
    color: '#b45309' // Deep amber
  },
  PR: {
    code: 'PR', nameTH: 'ใบขอซื้อ', nameEN: 'Purchase Request', prefix: 'PR',
    itemsTitleTh: 'รายการขอซื้อ', itemsTitleEn: 'Requested Items',
    showCustomer: false, showVendor: false, showShipTo: false, showValidUntil: false,
    showDueDate: true, showPaymentTerms: false, showTermsAndConditions: true, showSignature: true,
    showRequester: true,
    itemColumns: ['itemNo', 'description', 'qty', 'unit', 'price', 'amount'],
    color: '#475569' // Deep slate
  }
};

export const DOC_LABELS: Record<DocLang, Record<string, unknown>> = {
  th: {
    docTitle: { QUO: 'ใบเสนอราคา', INV: 'ใบแจ้งหนี้', BILL: 'ใบวางบิล', TAX: 'ใบกำกับภาษี', TAXRCPT: 'ใบเสร็จรับเงิน/ใบกำกับภาษี', RCPT: 'ใบเสร็จรับเงิน', DO: 'ใบส่งของ', PO: 'ใบสั่งซื้อ', CN: 'ใบลดหนี้', PV: 'ใบสำคัญจ่าย', PR: 'ใบขอซื้อ' },
    docNo: 'เลขที่', date: 'วันที่', dueDate: 'วันครบกำหนด', validUntil: 'ใช้ได้ถึง',
    customer: 'ลูกค้า', vendor: 'ผู้ขาย', billTo: 'เรียกเก็บเงินจาก', shipTo: 'ส่งถึง',
    taxId: 'เลขประจำตัวผู้เสียภาษี', phone: 'โทรศัพท์', email: 'อีเมล', address: 'ที่อยู่',
    no: 'ลำดับ', itemNo: 'รหัสสินค้า', description: 'รายการ', qty: 'จำนวน', unit: 'หน่วย',
    price: 'ราคา/หน่วย', discount: 'ส่วนลด', amount: 'จำนวนเงิน',
    subtotal: 'รวมเงิน', itemDiscount: 'ส่วนลดรายการ', totalDiscount: 'ส่วนลดรวม',
    afterDiscount: 'ยอดหลังหักส่วนลด', vat: 'ภาษีมูลค่าเพิ่ม', wht: 'หัก ณ ที่จ่าย',
    grandTotal: 'ยอดสุทธิ', paymentTerms: 'เงื่อนไขการชำระเงิน',
    termsAndConditions: 'ข้อกำหนดและเงื่อนไข', notes: 'หมายเหตุ',
    preparedBy: 'ผู้จัดทำ', approvedBy: 'ผู้อนุมัติ', receivedBy: 'ผู้รับ',
    signature: 'ลงนาม', dateSigned: 'วันที่',
    thankYou: 'ขอบคุณที่ใช้บริการ', contact: 'หากมีข้อสงสัย กรุณาติดต่อ',
    paymentMethod: 'ชำระโดย', refDoc: 'อ้างอิงเอกสาร',
    requester: 'ผู้ขอซื้อ', department: 'แผนก',
    shipVia: 'ส่งโดย', fob: 'F.O.B.', shippingTerms: 'เงื่อนไขการจัดส่ง',
    docNoLabel: 'เลขที่เอกสาร', customerNameLabel: 'ชื่อ', customerCodeLabel: 'รหัสลูกค้า',
    itemsTitle: 'รายการสินค้า / บริการ',
    codeCol: 'รหัส', descCol: 'รายการ', detailCol: 'รายละเอียด',
    qtyCol: 'จำนวน', unitCol: 'หน่วย', unitPriceCol: 'ราคา/หน่วย', amountCol: 'จำนวนเงิน', totalCol: 'รวม',
    noItems: 'ไม่มีรายการ', paymentTitle: 'การชำระเงิน',
    bankLabel: '', accountNo: 'เลขที่บัญชี', accountNameLabel: 'ชื่อบัญชี',
    paymentStatusLabel: 'สถานะการชำระ', paidAmount: 'ชำระเงินจำนวน', installment: 'แบ่งชำระ',
    copyBadge: 'สำเนา', originalBadge: 'ต้นฉบับ', companyFallback: 'ชื่อบริษัท',
    salespersonLabel: 'ผู้ขาย',
    receiverOf: 'ผู้รับ', issuerOf: 'ผู้ออก',
    receiverOfRCPT: 'ผู้รับเงิน', issuerOfRCPT: 'ผู้ออกใบเสร็จรับเงิน',
    itemDiscountLabel: 'รายการ', beforeTax: 'ยอดก่อนภาษี',
    pageLabel: 'หน้า', pageOf: 'จาก',
    carryForward: 'ยอดยกไป', broughtForward: 'ยอดยกมา',
    taxCol: 'ภาษี', taxExempt: 'ยกเว้น', taxNone: '-',
    exemptTotal: 'มูลค่ายกเว้นภาษี'
  },
  en: {
    docTitle: { QUO: 'QUOTATION', INV: 'INVOICE', BILL: 'BILLING NOTE', TAX: 'TAX INVOICE', TAXRCPT: 'RECEIPT / TAX INVOICE', RCPT: 'RECEIPT', DO: 'DELIVERY ORDER', PO: 'PURCHASE ORDER', CN: 'CREDIT NOTE', PV: 'PAYMENT VOUCHER', PR: 'PURCHASE REQUEST' },
    docNo: 'No.', date: 'Date', dueDate: 'Due Date', validUntil: 'Valid Until',
    customer: 'Customer', vendor: 'Vendor', billTo: 'Bill To', shipTo: 'Ship To',
    taxId: 'Tax ID', phone: 'Phone', email: 'Email', address: 'Address',
    no: 'No.', itemNo: 'Item #', description: 'Description', qty: 'Qty', unit: 'Unit',
    price: 'Unit Price', discount: 'Discount', amount: 'Amount',
    subtotal: 'Subtotal', itemDiscount: 'Item Discount', totalDiscount: 'Total Discount',
    afterDiscount: 'After Discount', vat: 'VAT', wht: 'Withholding Tax',
    grandTotal: 'TOTAL', paymentTerms: 'Payment Terms',
    termsAndConditions: 'Terms and Conditions', notes: 'Notes',
    preparedBy: 'Prepared By', approvedBy: 'Approved By', receivedBy: 'Received By',
    signature: 'Signature', dateSigned: 'Date',
    thankYou: 'Thank You For Your Business!', contact: 'If you have any questions, please contact',
    paymentMethod: 'Payment Method', refDoc: 'Reference Doc',
    requester: 'Requester', department: 'Department',
    shipVia: 'Ship Via', fob: 'F.O.B.', shippingTerms: 'Shipping Terms',
    docNoLabel: 'Document No.', customerNameLabel: 'Name', customerCodeLabel: 'Customer Code',
    itemsTitle: 'Items / Services',
    codeCol: 'Code', descCol: 'Description', detailCol: 'Detail',
    qtyCol: 'Qty', unitCol: 'Unit', unitPriceCol: 'Unit Price', amountCol: 'Amount', totalCol: 'Total',
    noItems: 'No items', paymentTitle: 'Payment',
    bankLabel: 'Bank:', accountNo: 'Account No.', accountNameLabel: 'Account Name',
    paymentStatusLabel: 'Payment Status', paidAmount: 'Paid Amount', installment: 'Installment',
    copyBadge: 'COPY', originalBadge: 'ORIGINAL', companyFallback: 'Company Name',
    salespersonLabel: 'Salesperson',
    receiverOf: 'Received By', issuerOf: 'Issued By',
    receiverOfRCPT: 'Payee', issuerOfRCPT: 'Receipt Issuer',
    itemDiscountLabel: 'Item', beforeTax: 'Amount Before Tax',
    pageLabel: 'Page', pageOf: 'of',
    carryForward: 'Carried Forward', broughtForward: 'Brought Forward',
    taxCol: 'Tax', taxExempt: 'Exempt', taxNone: '-',
    exemptTotal: 'Tax Exempt Amount'
  }
};

export function getDocConfig(docType: DocType): DocTypeConfig {
  return DOC_CONFIG[docType] || DOC_CONFIG.QUO;
}

export function getDocLabel(lang: DocLang, key: string): string {
  const labels = DOC_LABELS[lang] || DOC_LABELS.th;
  return (labels[key] as string) || key;
}

export function getDocTitle(lang: DocLang, docType: DocType): string {
  const labels = DOC_LABELS[lang] || DOC_LABELS.th;
  const titles = labels.docTitle as Record<string, string>;
  return titles[docType] || docType;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'sarabun', label: 'Sarabun', css: '"Sarabun", "Noto Sans Thai", "IBM Plex Sans Thai", Arial, sans-serif' },
  { id: 'noto', label: 'Noto Sans Thai', css: '"Noto Sans Thai", "Sarabun", Arial, sans-serif' },
  { id: 'ibm', label: 'IBM Plex Sans Thai', css: '"IBM Plex Sans Thai", "Sarabun", Arial, sans-serif' },
  { id: 'system', label: 'System UI', css: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif' }
];

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'blue', label: 'Blue', value: '#1f3a5f' },      // Custom Navy
  { id: 'indigo', label: 'Indigo', value: '#3730a3' },  // Indigo 800
  { id: 'slate', label: 'Slate', value: '#334155' },    // Slate 700
  { id: 'teal', label: 'Teal', value: '#115e59' },      // Teal 800
  { id: 'purple', label: 'Purple', value: '#5b21b6' },  // Purple 800
];

export const DEFAULT_SETTINGS = {
  currency: 'THB',
  vatRate: 7,
  whtRate: 3,
  theme: 'blue',
  font: 'sarabun'
} as const;

export const CODE_PREFIX: Record<string, string> = {
  COMPANY: 'CO',
  CUSTOMER: 'C',
  PRODUCT: 'P',
  SALESPERSON: 'SP'
};

export const CODE_PAD_LENGTH = 4;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'ยังไม่ชำระ',
  PARTIAL: 'ชำระบางส่วน',
  PAID: 'ชำระแล้ว',
  OVERDUE: 'เกินกำหนด'
};

export const DOC_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'ร่าง',
  ISSUED: 'ออกแล้ว',
  CONVERTED: 'ออกบิลแล้ว',
  CANCELLED: 'ยกเลิก'
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'gray',
  PARTIAL: 'warning',
  PAID: 'success',
  OVERDUE: 'danger'
};

export const DOC_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'blue',
  ISSUED: 'success',
  CONVERTED: 'warning',
  CANCELLED: 'danger'
};

export const DOC_FLOW: Record<string, { primary: DocType | null; skip: DocType[]; special: DocType[] }> = {
  QUO:  { primary: 'INV',  skip: ['DO'],              special: [] },
  INV:  { primary: 'TAX',  skip: ['TAXRCPT', 'RCPT', 'BILL'],    special: ['CN'] },
  BILL: { primary: 'RCPT', skip: [],                   special: [] },
  TAX:  { primary: 'RCPT', skip: [],                   special: ['CN'] },
  TAXRCPT: { primary: null,  skip: [],                   special: ['CN'] },
  DO:   { primary: 'INV',  skip: [],                   special: [] },
  PR:   { primary: 'PO',   skip: [],                   special: [] },
  RCPT: { primary: null,   skip: [],                   special: [] },
  PO:   { primary: null,   skip: [],                   special: [] },
  CN:   { primary: null,   skip: [],                   special: [] },
  PV:   { primary: null,   skip: [],                   special: [] },
};

// Derived from DOC_FLOW for backward compatibility
export const DOC_TYPE_CONVERSIONS: Record<string, DocType[]> = Object.fromEntries(
  Object.entries(DOC_FLOW).map(([key, flow]) => [
    key,
    [flow.primary, ...flow.skip, ...flow.special].filter((t): t is DocType => t !== null)
  ])
) as Record<string, DocType[]>;
