// ===== Entity Types =====

export type EntityType = 'COMPANY' | 'CUSTOMER' | 'PRODUCT' | 'SALESPERSON';

export interface MasterEntity {
  entityId: string;
  entityType: EntityType;
  userId: string;
  companyId: string;
  code: string;
  name: string;
  name2: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  tags: string;
  status: 'ACTIVE' | 'INACTIVE';
  isDeleted: boolean;
  json: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Company extends MasterEntity {
  entityType: 'COMPANY';
  json: {
    branchName?: string;
    branchNo?: string;
    vatRegistered?: boolean;
    logo?: string;
    logoFileId?: string;
    logoUrl?: string;
    bankAccounts?: BankAccount[];
    signatureFileId?: string;
    signatureUrl?: string;
    signerName?: string;
    signerTitle?: string;
    [key: string]: unknown;
  };
}

export interface Customer extends MasterEntity {
  entityType: 'CUSTOMER';
  json: {
    billingAddress?: string;
    shippingAddress?: string;
    contactPersons?: ContactPerson[];
    creditTermDays?: number;
    [key: string]: unknown;
  };
}

export interface Product extends MasterEntity {
  entityType: 'PRODUCT';
  json: {
    sku?: string;
    unit?: string;
    price?: number;
    purchasePrice?: number;
    vatType?: string;
    imageFileId?: string;
    imageUrl?: string;
    category?: string;
    stockEnabled?: boolean;
    stockQty?: number;
    minStock?: number;
    stockLogs?: StockLog[];
    [key: string]: unknown;
  };
}

export interface StockLog {
  date: string;
  qty: number;
  type: 'IN' | 'OUT' | 'ADJUST';
  reason: string;
  refDocNo?: string;
}

export interface Salesperson extends MasterEntity {
  entityType: 'SALESPERSON';
  json: {
    position?: string;
    department?: string;
    [key: string]: unknown;
  };
}

export interface BankAccount {
  bankName: string;
  accountName: string;
  accountNo: string;
  branch?: string;
  qrCodeImage?: string;
}

export interface ContactPerson {
  name: string;
  phone?: string;
  email?: string;
  position?: string;
}

// ===== Document Types =====

export type DocType = 'QUO' | 'INV' | 'BILL' | 'TAX' | 'TAXRCPT' | 'RCPT' | 'DO' | 'PO' | 'CN' | 'PV' | 'PR';
export type DocCategory = 'sales' | 'purchase' | 'finance';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
export type DocStatus = 'DRAFT' | 'ISSUED' | 'CONVERTED' | 'CANCELLED';

export type DocLang = 'th' | 'en';

export type ItemColumnKey = 'itemNo' | 'description' | 'qty' | 'unit' | 'price' | 'discount' | 'amount' | 'docRef' | 'docDate' | 'dueDate';

export interface DocTypeConfig {
  code: string;
  nameTH: string;
  nameEN: string;
  prefix: string;
  itemsTitleTh?: string;
  itemsTitleEn?: string;
  showCustomer: boolean;
  showVendor: boolean;
  showShipTo: boolean;
  showValidUntil: boolean;
  showDueDate: boolean;
  showPaymentTerms: boolean;
  showTermsAndConditions: boolean;
  showSignature: boolean;
  showPaymentMethod?: boolean;
  showDeliveryInfo?: boolean;
  showRefDoc?: boolean;
  showRequester?: boolean;
  showShippingTerms?: boolean;
  itemColumns: ItemColumnKey[];
  color: string;
}

export interface DocTypeInfo {
  id: DocType;
  label: string;
  labelTh: string;
  category: DocCategory;
}

export interface DocumentHeader {
  docId: string;
  docType: DocType;
  userId: string;
  companyId: string;
  customerId: string;
  docNo: string;
  docDate: string;
  dueDate: string;
  refDocNo: string;
  refDocId: string;
  currency: string;
  subtotal: number;
  discountEnabled: boolean;
  discountType: 'AMOUNT' | 'PERCENT';
  discountValue: number;
  vatEnabled: boolean;
  vatRate: number;
  whtEnabled: boolean;
  whtRate: number;
  totalBeforeTax: number;
  vatAmount: number;
  whtAmount: number;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  docStatus: DocStatus;
  notes: string;
  terms: string;
  signatureEnabled: boolean;
  pdfFileId: string;
  isDeleted: boolean;
  json: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocLine {
  lineId: string;
  docId: string;
  lineNo: number;
  productId: string;
  code: string;
  name: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discountType: string;
  discountValue: number;
  lineTotal: number;
  taxRate?: string;
  json: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentWithLines {
  header: DocumentHeader;
  lines: DocLine[];
}

// ===== Settings =====

export interface Setting {
  key: string;
  scopeType: 'GLOBAL' | 'USER' | 'COMPANY';
  scopeId: string;
  value: string;
  updatedAt: string;
}

// ===== Events =====

export type EventType = 'DOC_CREATED' | 'DOC_UPDATED' | 'DOC_DELETED' | 'PAYMENT_UPDATED' | 'STATUS_CHANGE' | 'EXPORT' | 'IMPORT';

export interface AppEvent {
  eventId: string;
  userId: string;
  companyId: string;
  eventType: EventType;
  refType: string;
  refId: string;
  userEmail: string;
  amount: number;
  fromStatus: string;
  toStatus: string;
  note: string;
  json: Record<string, unknown>;
  createdAt: string;
}

// ===== Files =====

export interface FileRecord {
  fileId: string;
  userId: string;
  companyId: string;
  refType: 'COMPANY_LOGO' | 'PRODUCT_IMAGE' | 'DOC_PDF';
  refId: string;
  mimeType: string;
  name: string;
  size: number;
  driveFileId: string;
  url: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== KPI =====

export interface KpiData {
  salesThisMonth: number;
  unpaidTotal: number;
  paidThisMonth: number;
  vatOutputThisMonth: number;
  totalRevenue: number;
  totalDocuments: number;
  period: string;
}

export interface SalesTrendItem {
  month: string;
  label: string;
  total: number;
  sales: number;
  count: number;
}

export interface TopCustomerItem {
  customerId: string;
  customerName: string;
  total: number;
  count: number;
}

export interface TopProductItem {
  productId: string;
  name: string;
  total: number;
  qty: number;
}

// ===== UI Config =====

export interface FontOption {
  id: string;
  label: string;
  css: string;
}

export interface ThemeOption {
  id: string;
  label: string;
  value: string;
}

// ===== App State =====

export interface AppState {
  currentView: string;
  companyId: string;
  companies: Company[];
  customers: Customer[];
  products: Product[];
  salespersons: Salesperson[];
  settings: Record<string, string>;
}

// ===== Product Picker =====

export interface PickedItem {
  productId: string;
  name: string;
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  qty: number;
  category: string;
}

// ===== User & Auth =====

export interface User {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string;
  authProvider: 'email' | 'google' | 'line';
  googleId?: string;
  driveFolderId?: string;
  isActive: boolean;
  isAdmin: boolean;
  billingStatus: 'PAID' | 'UNPAID';
  isOwner?: boolean;
  hasTeamAccess?: boolean;
  teamPermissions?: string[];
  teamCompanyIds?: string[];
  createdAt: string;
  updatedAt: string;
}

// ===== Team Members =====

export type TeamPermission = 'dashboard' | 'documents' | 'history' | 'customers' | 'products' | 'salespersons' | 'payments' | 'purchases' | 'settings';

export interface TeamMember {
  memberId: string;
  companyId: string;
  companyIds?: string[];
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  permissions: TeamPermission[];
  status: 'pending' | 'active' | 'disabled';
  inviteToken?: string;
  inviteExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Overlay Items (for doc preview) =====

export interface OverlayItem {
  id: 'stamp' | 'signature';
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  grayscale: boolean;
}

// ===== Toast =====

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  action?: { label: string; href: string };
}
