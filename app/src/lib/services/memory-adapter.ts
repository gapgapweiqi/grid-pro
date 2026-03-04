/**
 * InMemoryAdapter — StorageAdapter backed by in-memory arrays.
 * Seeded with mock data for development. Will be replaced by D1Adapter later.
 */
import type {
  MasterEntity, EntityType, Company, Customer, Product, Salesperson,
  DocumentHeader, DocLine, DocumentWithLines,
  KpiData, SalesTrendItem, TopCustomerItem, TopProductItem,
  PaymentStatus, DocStatus
} from '$lib/types';
import type {
  StorageAdapter, ApiResult, ListQuery, DocQuery, PageMeta,
  BootstrapData, CompanyBootstrapData
} from './storage-adapter';
import { generateUuid, nowIso } from '$lib/utils/helpers';
import { db } from '$lib/db/local';

// Write-back helper: persist a single master entity to IndexedDB
function persistMaster(entity: MasterEntity) {
  try { db.master.put(entity).catch(() => {}); } catch {}
}

// Write-back helper: persist a document header + lines to IndexedDB
function persistDoc(header: DocumentHeader, lines?: DocLine[]) {
  try {
    db.documents.put(header).catch(() => {});
    if (lines) {
      db.docLines.where('docId').equals(header.docId).delete().then(() => {
        db.docLines.bulkPut(lines).catch(() => {});
      }).catch(() => {});
    }
  } catch {}
}

// ===== Helper =====

function ok<T>(data: T, meta?: Record<string, unknown>): ApiResult<T> {
  return { ok: true, data, meta };
}

function err<T>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function pageMeta(total: number, limit: number, offset: number): PageMeta {
  return { total, limit, offset, hasMore: offset + limit < total };
}

// ===== In-Memory Store =====

const store = {
  companies: [] as Company[],
  customers: [] as Customer[],
  products: [] as Product[],
  salespersons: [] as Salesperson[],
  documents: [] as DocumentHeader[],
  docLines: [] as DocLine[],
  settings: {} as Record<string, string>
};

function getEntityStore(type: EntityType): MasterEntity[] {
  switch (type) {
    case 'COMPANY': return store.companies;
    case 'CUSTOMER': return store.customers;
    case 'PRODUCT': return store.products;
    case 'SALESPERSON': return store.salespersons;
  }
}

function setEntityStore(type: EntityType, items: MasterEntity[]) {
  switch (type) {
    case 'COMPANY': store.companies = items as Company[]; break;
    case 'CUSTOMER': store.customers = items as Customer[]; break;
    case 'PRODUCT': store.products = items as Product[]; break;
    case 'SALESPERSON': store.salespersons = items as Salesperson[]; break;
  }
}

// ===== Seed from mock-data =====

export function seedStore(data: {
  companies?: Company[];
  customers?: Customer[];
  products?: Product[];
  salespersons?: Salesperson[];
  documents?: DocumentHeader[];
  docLines?: DocLine[];
}) {
  if (data.companies) store.companies = [...data.companies];
  if (data.customers) store.customers = [...data.customers];
  if (data.products) store.products = [...data.products];
  if (data.salespersons) store.salespersons = [...data.salespersons];
  if (data.documents) store.documents = [...data.documents];
  if (data.docLines) store.docLines = [...data.docLines];
}

const DATA_VERSION = '3'; // Bump this to force re-seed from mock data

/** Load persisted data from IndexedDB back into in-memory store. Returns true if data was loaded. */
export async function loadFromLocal(): Promise<boolean> {
  try {
    // Check data version — if mismatch, clear stale data and re-seed
    const ver = await db.settings.where('key').equals('data-version').first();
    if (!ver || ver.value !== DATA_VERSION) {
      await db.master.clear();
      await db.documents.clear();
      await db.docLines.clear();
      await db.settings.where('key').equals('data-version').delete();
      await db.settings.add({ key: 'data-version', value: DATA_VERSION } as any);
      return false;
    }

    const count = await db.master.count();
    if (count === 0) return false;

    const allMaster = await db.master.toArray();
    store.companies = allMaster.filter(e => e.entityType === 'COMPANY') as Company[];
    store.customers = allMaster.filter(e => e.entityType === 'CUSTOMER') as Customer[];
    store.products = allMaster.filter(e => e.entityType === 'PRODUCT') as Product[];
    store.salespersons = allMaster.filter(e => e.entityType === 'SALESPERSON') as Salesperson[];
    store.documents = await db.documents.toArray() as DocumentHeader[];
    store.docLines = await db.docLines.toArray() as DocLine[];
    return true;
  } catch {
    return false;
  }
}

// ===== Adapter Implementation =====

export const memoryAdapter: StorageAdapter = {

  // --- Bootstrap ---

  async bootstrap(): Promise<ApiResult<BootstrapData>> {
    return ok({
      companies: store.companies.filter(c => !c.isDeleted),
      settings: { ...store.settings }
    });
  },

  async bootstrapCompany(companyId: string): Promise<ApiResult<CompanyBootstrapData>> {
    const customers = store.customers.filter(c => c.companyId === companyId && !c.isDeleted);
    const products = store.products.filter(p => p.companyId === companyId && !p.isDeleted);
    const salespersons = store.salespersons.filter(s => s.companyId === companyId && !s.isDeleted);
    const kpiResult = await this.getKpi(companyId);
    const kpi = kpiResult.ok ? kpiResult.data : { salesThisMonth: 0, unpaidTotal: 0, paidThisMonth: 0, vatOutputThisMonth: 0, totalRevenue: 0, totalDocuments: 0, period: '' };
    const unpaidDocs = store.documents.filter(d =>
      d.companyId === companyId && !d.isDeleted &&
      d.docType !== 'QUO' && (d.paymentStatus === 'UNPAID' || d.paymentStatus === 'OVERDUE')
    );
    return ok({ customers, products, salespersons, kpi, unpaidDocs });
  },

  // --- Master Data ---

  async masterList<T extends MasterEntity>(entityType: EntityType, query: ListQuery): Promise<ApiResult<{ items: T[]; meta: PageMeta }>> {
    let items = getEntityStore(entityType).filter(e =>
      e.companyId === query.companyId && !e.isDeleted &&
      (!query.status || e.status === query.status)
    );

    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.name2 || '').toLowerCase().includes(q)
      );
    }

    if (query.sinceUpdatedAt) {
      items = items.filter(e => e.updatedAt > query.sinceUpdatedAt!);
    }

    const total = items.length;
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const paged = items.slice(offset, offset + limit);
    return ok({ items: paged as T[], meta: pageMeta(total, limit, offset) });
  },

  async masterGet<T extends MasterEntity>(entityType: EntityType, entityId: string): Promise<ApiResult<T>> {
    const item = getEntityStore(entityType).find(e => e.entityId === entityId && !e.isDeleted);
    if (!item) return err('NOT_FOUND', `${entityType} ${entityId} not found`);
    return ok(item as T);
  },

  async masterUpsert<T extends MasterEntity>(entityType: EntityType, payload: Partial<T> & { entityId?: string; companyId: string }): Promise<ApiResult<T>> {
    const items = getEntityStore(entityType);
    const now = nowIso();

    if (payload.entityId) {
      // Update
      const idx = items.findIndex(e => e.entityId === payload.entityId);
      if (idx === -1) return err('NOT_FOUND', `${entityType} ${payload.entityId} not found`);
      const updated = { ...items[idx], ...payload, updatedAt: now } as MasterEntity;
      items[idx] = updated;
      persistMaster(updated);
      return ok(updated as T);
    } else {
      // Create
      const newItem = {
        entityId: generateUuid(),
        entityType,
        userId: 'user-001',
        code: '',
        name: '',
        name2: '',
        taxId: '',
        phone: '',
        email: '',
        address: '',
        tags: '',
        status: 'ACTIVE',
        isDeleted: false,
        json: {},
        createdAt: now,
        updatedAt: now,
        ...payload
      } as MasterEntity;
      items.push(newItem);
      persistMaster(newItem);
      return ok(newItem as T);
    }
  },

  async masterDelete(entityType: EntityType, ids: string[]): Promise<ApiResult<{ deleted: number }>> {
    const items = getEntityStore(entityType);
    let deleted = 0;
    const idSet = new Set(ids);
    for (const item of items) {
      if (idSet.has(item.entityId) && !item.isDeleted) {
        item.isDeleted = true;
        item.updatedAt = nowIso();
        persistMaster(item);
        deleted++;
      }
    }
    return ok({ deleted });
  },

  // --- Documents ---

  async docQuery(query: DocQuery): Promise<ApiResult<{ items: DocumentHeader[]; meta: PageMeta }>> {
    let items = store.documents.filter(d => d.companyId === query.companyId && !d.isDeleted);

    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(d =>
        d.docNo.toLowerCase().includes(q) ||
        ((d.json as Record<string, string>)?.customerName || '').toLowerCase().includes(q)
      );
    }
    if (query.docType) items = items.filter(d => d.docType === query.docType);
    if (query.paymentStatus) items = items.filter(d => d.paymentStatus === query.paymentStatus);
    if (query.docStatus) items = items.filter(d => d.docStatus === query.docStatus);
    if (query.dateFrom) items = items.filter(d => d.docDate >= query.dateFrom!);
    if (query.dateTo) items = items.filter(d => d.docDate <= query.dateTo!);
    if (query.customerId) items = items.filter(d => d.customerId === query.customerId);

    items.sort((a, b) => b.docDate.localeCompare(a.docDate));

    const total = items.length;
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const paged = items.slice(offset, offset + limit);
    return ok({ items: paged, meta: pageMeta(total, limit, offset) });
  },

  async docGet(docId: string): Promise<ApiResult<DocumentWithLines>> {
    const header = store.documents.find(d => d.docId === docId && !d.isDeleted);
    if (!header) return err('NOT_FOUND', `Document ${docId} not found`);
    const lines = store.docLines.filter(l => l.docId === docId).sort((a, b) => a.lineNo - b.lineNo);
    return ok({ header, lines });
  },

  async docUpsert(header: Partial<DocumentHeader> & { companyId: string }, lines: Partial<DocLine>[]): Promise<ApiResult<DocumentWithLines>> {
    const now = nowIso();

    let doc: DocumentHeader;
    if (header.docId) {
      // Update existing
      const idx = store.documents.findIndex(d => d.docId === header.docId);
      if (idx === -1) return err('NOT_FOUND', `Document ${header.docId} not found`);
      doc = { ...store.documents[idx], ...header, updatedAt: now };
      store.documents[idx] = doc;
      // Replace lines
      store.docLines = store.docLines.filter(l => l.docId !== doc.docId);
    } else {
      // Create new
      doc = {
        docId: generateUuid(),
        docType: 'INV',
        userId: 'user-001',
        customerId: '',
        docNo: '',
        docDate: new Date().toISOString().substring(0, 10),
        dueDate: '',
        refDocNo: '',
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
        docStatus: 'DRAFT',
        notes: '',
        terms: '',
        signatureEnabled: true,
        pdfFileId: '',
        isDeleted: false,
        json: {},
        createdAt: now,
        updatedAt: now,
        ...header
      } as DocumentHeader;
      store.documents.push(doc);
    }

    // Insert lines
    const savedLines: DocLine[] = lines.map((l, i) => {
      const line: DocLine = {
        lineId: l.lineId || generateUuid(),
        docId: doc.docId,
        lineNo: i + 1,
        productId: l.productId || '',
        code: l.code || '',
        name: l.name || '',
        description: l.description || '',
        qty: l.qty || 0,
        unit: l.unit || '',
        unitPrice: l.unitPrice || 0,
        discountType: l.discountType || '',
        discountValue: l.discountValue || 0,
        lineTotal: l.lineTotal || 0,
        json: l.json || {},
        createdAt: now,
        updatedAt: now
      };
      store.docLines.push(line);
      return line;
    });

    persistDoc(doc, savedLines);
    return ok({ header: doc, lines: savedLines });
  },

  async docDelete(docIds: string[]): Promise<ApiResult<{ deleted: number }>> {
    const idSet = new Set(docIds);
    let deleted = 0;
    for (const doc of store.documents) {
      if (idSet.has(doc.docId) && !doc.isDeleted) {
        doc.isDeleted = true;
        doc.updatedAt = nowIso();
        persistDoc(doc);
        deleted++;
      }
    }
    return ok({ deleted });
  },

  async docUpdateStatus(docId: string, field: 'paymentStatus' | 'docStatus', value: string, extra?: Record<string, any>): Promise<ApiResult<DocumentHeader>> {
    const doc = store.documents.find(d => d.docId === docId && !d.isDeleted);
    if (!doc) return err('NOT_FOUND', `Document ${docId} not found`);
    if (field === 'paymentStatus') doc.paymentStatus = value as PaymentStatus;
    else doc.docStatus = value as DocStatus;
    if (extra?.paymentMethod !== undefined) {
      const json = (doc.json && typeof doc.json === 'object') ? { ...(doc.json as Record<string, any>) } : {};
      json.paymentMethod = extra.paymentMethod;
      doc.json = json;
    }
    doc.updatedAt = nowIso();
    persistDoc(doc);
    return ok({ ...doc });
  },

  // --- KPI ---

  async getKpi(companyId: string): Promise<ApiResult<KpiData>> {
    const docs = store.documents.filter(d => d.companyId === companyId && !d.isDeleted);
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const period = months[now.getMonth()] + ' ' + String(now.getFullYear() + 543).substring(2);

    let salesThisMonth = 0, paidThisMonth = 0, unpaidTotal = 0, vatOutput = 0, totalRevenue = 0;
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

    return ok({
      salesThisMonth: Math.round(salesThisMonth * 100) / 100,
      unpaidTotal: Math.round(unpaidTotal * 100) / 100,
      paidThisMonth: Math.round(paidThisMonth * 100) / 100,
      vatOutputThisMonth: Math.round(vatOutput * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDocuments: docs.length,
      period
    });
  },

  async getSalesTrend(companyId: string, months = 6): Promise<ApiResult<SalesTrendItem[]>> {
    const now = new Date();
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const docs = store.documents.filter(d => d.companyId === companyId && !d.isDeleted);
    const result: SalesTrendItem[] = [];

    for (let m = months - 1; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = monthNames[d.getMonth()] + ' ' + String(d.getFullYear() + 543).substring(2);
      let total = 0, count = 0;
      for (const doc of docs) {
        if ((doc.docDate || '').substring(0, 7) === ym) { total += doc.grandTotal; count++; }
      }
      result.push({ month: label, label, total: Math.round(total * 100) / 100, sales: Math.round(total * 100) / 100, count });
    }
    return ok(result);
  },

  async getTopCustomers(companyId: string, limit = 5): Promise<ApiResult<TopCustomerItem[]>> {
    const docs = store.documents.filter(d => d.companyId === companyId && !d.isDeleted && d.customerId);
    const map: Record<string, TopCustomerItem> = {};
    for (const d of docs) {
      const cname = (d.json as Record<string, string>)?.customerName || d.customerId;
      if (!map[d.customerId]) map[d.customerId] = { customerId: d.customerId, customerName: cname, total: 0, count: 0 };
      map[d.customerId].total += d.grandTotal;
      map[d.customerId].count++;
    }
    return ok(Object.values(map).sort((a, b) => b.total - a.total).slice(0, limit));
  },

  async getTopProducts(companyId: string, limit = 5): Promise<ApiResult<TopProductItem[]>> {
    const docIds = new Set(store.documents.filter(d => d.companyId === companyId && !d.isDeleted).map(d => d.docId));
    const lines = store.docLines.filter(l => docIds.has(l.docId));
    const map: Record<string, TopProductItem> = {};
    for (const l of lines) {
      const key = l.productId || l.name;
      if (!map[key]) map[key] = { productId: key, name: l.name, total: 0, qty: 0 };
      map[key].total += l.lineTotal;
      map[key].qty += l.qty;
    }
    return ok(Object.values(map).sort((a, b) => b.total - a.total).slice(0, limit));
  },

  // --- Settings ---

  async getSetting(key: string): Promise<ApiResult<string | null>> {
    return ok(store.settings[key] ?? null);
  },

  async setSetting(key: string, value: string): Promise<ApiResult<void>> {
    store.settings[key] = value;
    return ok(undefined as unknown as void);
  }
};
