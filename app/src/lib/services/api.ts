/**
 * API Service — single entry point for all data operations.
 * Wraps the active StorageAdapter and provides typed, convenient methods.
 * Pages import from here instead of directly accessing mock data.
 */
import type { StorageAdapter, ApiResult, ListQuery, DocQuery } from './storage-adapter';
import type {
  Company, Customer, Product, Salesperson, MasterEntity, EntityType,
  DocumentHeader, DocLine, DocumentWithLines,
  KpiData, SalesTrendItem, TopCustomerItem, TopProductItem
} from '$lib/types';
import { memoryAdapter, seedStore, loadFromLocal } from './memory-adapter';
import {
  MOCK_COMPANIES, MOCK_CUSTOMERS, MOCK_PRODUCTS, MOCK_SALESPERSONS,
  MOCK_DOCUMENTS, MOCK_DOC_LINES
} from './mock-data';

// ===== Active adapter (swap this to switch backends) =====

let adapter: StorageAdapter = memoryAdapter;
let initialized = false;

export function setAdapter(a: StorageAdapter) {
  adapter = a;
}

export function getAdapter(): StorageAdapter {
  return adapter;
}

/** Initialize the data layer — loads from IndexedDB if available, else seeds from mock data */
export async function initApi() {
  if (initialized) return;
  const loaded = await loadFromLocal();
  if (!loaded) {
    seedStore({
      companies: MOCK_COMPANIES,
      customers: MOCK_CUSTOMERS,
      products: MOCK_PRODUCTS,
      salespersons: MOCK_SALESPERSONS,
      documents: MOCK_DOCUMENTS,
      docLines: MOCK_DOC_LINES
    });
  }
  initialized = true;
}

// ===== Convenience Wrappers =====

/** Unwrap ApiResult — returns data or throws */
function unwrap<T>(result: ApiResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(result.error.message);
}

// --- Bootstrap ---

export const api = {
  async bootstrap() {
    await initApi();
    return adapter.bootstrap();
  },

  async bootstrapCompany(companyId: string) {
    return adapter.bootstrapCompany(companyId);
  },

  // --- Companies ---

  async listCompanies(query: Partial<ListQuery> = {}): Promise<Company[]> {
    const result = await adapter.masterList<Company>('COMPANY', { companyId: query.companyId || '', ...query });
    return result.ok ? result.data.items : [];
  },

  async getCompany(entityId: string): Promise<Company | null> {
    const result = await adapter.masterGet<Company>('COMPANY', entityId);
    return result.ok ? result.data : null;
  },

  async upsertCompany(payload: Partial<Company> & { companyId?: string }): Promise<ApiResult<Company>> {
    return adapter.masterUpsert<Company>('COMPANY', { companyId: payload.companyId || payload.entityId || '', ...payload });
  },

  async deleteCompanies(ids: string[]) {
    return adapter.masterDelete('COMPANY', ids);
  },

  // --- Customers ---

  async listCustomers(companyId: string, query: Partial<ListQuery> = {}): Promise<Customer[]> {
    await initApi();
    const result = await adapter.masterList<Customer>('CUSTOMER', { companyId, ...query });
    return result.ok ? result.data.items : [];
  },

  async getCustomer(entityId: string): Promise<Customer | null> {
    const result = await adapter.masterGet<Customer>('CUSTOMER', entityId);
    return result.ok ? result.data : null;
  },

  async upsertCustomer(payload: Partial<Customer> & { companyId: string }): Promise<ApiResult<Customer>> {
    return adapter.masterUpsert<Customer>('CUSTOMER', payload);
  },

  async deleteCustomers(ids: string[]) {
    return adapter.masterDelete('CUSTOMER', ids);
  },

  // --- Products ---

  async listProducts(companyId: string, query: Partial<ListQuery> = {}): Promise<Product[]> {
    await initApi();
    const result = await adapter.masterList<Product>('PRODUCT', { companyId, ...query });
    return result.ok ? result.data.items : [];
  },

  async getProduct(entityId: string): Promise<Product | null> {
    const result = await adapter.masterGet<Product>('PRODUCT', entityId);
    return result.ok ? result.data : null;
  },

  async upsertProduct(payload: Partial<Product> & { companyId: string }): Promise<ApiResult<Product>> {
    return adapter.masterUpsert<Product>('PRODUCT', payload);
  },

  async deleteProducts(ids: string[]) {
    return adapter.masterDelete('PRODUCT', ids);
  },

  // --- Salespersons ---

  async listSalespersons(companyId: string, query: Partial<ListQuery> = {}): Promise<Salesperson[]> {
    await initApi();
    const result = await adapter.masterList<Salesperson>('SALESPERSON', { companyId, ...query });
    return result.ok ? result.data.items : [];
  },

  async upsertSalesperson(payload: Partial<Salesperson> & { companyId: string }): Promise<ApiResult<Salesperson>> {
    return adapter.masterUpsert<Salesperson>('SALESPERSON', payload);
  },

  async deleteSalespersons(ids: string[]) {
    return adapter.masterDelete('SALESPERSON', ids);
  },

  // --- Documents ---

  async queryDocs(companyId: string, query: Partial<DocQuery> = {}): Promise<{ items: DocumentHeader[]; total: number }> {
    const result = await adapter.docQuery({ companyId, ...query });
    return result.ok ? { items: result.data.items, total: result.data.meta.total } : { items: [], total: 0 };
  },

  async getDoc(docId: string): Promise<DocumentWithLines | null> {
    const result = await adapter.docGet(docId);
    return result.ok ? result.data : null;
  },

  async upsertDoc(header: Partial<DocumentHeader> & { companyId: string }, lines: Partial<DocLine>[]): Promise<ApiResult<DocumentWithLines>> {
    return adapter.docUpsert(header, lines);
  },

  async deleteDocs(docIds: string[]) {
    return adapter.docDelete(docIds);
  },

  async updateDocPayment(docId: string, status: string, paymentMethod?: string) {
    const extra = paymentMethod !== undefined ? { paymentMethod } : undefined;
    return adapter.docUpdateStatus(docId, 'paymentStatus', status, extra);
  },

  async updateDocStatus(docId: string, status: string) {
    return adapter.docUpdateStatus(docId, 'docStatus', status);
  },

  async getDocChain(docId: string): Promise<DocumentHeader[]> {
    // Try remote chain endpoint first (via api-adapter)
    try {
      const { docApi } = await import('./api-adapter');
      const result = await docApi.chain(docId);
      if (result.ok && Array.isArray(result.data)) return result.data;
    } catch {}
    // Fallback: empty (mock mode doesn't have chain endpoint)
    return [];
  },

  // --- Billing Note Helpers ---

  async listInvoicesForBilling(companyId: string, customerId: string): Promise<DocumentHeader[]> {
    const { items } = await this.queryDocs(companyId, { docType: 'INV' as any });
    return items.filter(d => d.customerId === customerId && d.paymentStatus === 'UNPAID' && d.docStatus !== 'CANCELLED');
  },

  // --- KPI ---

  async getKpi(companyId: string): Promise<KpiData> {
    const result = await adapter.getKpi(companyId);
    return result.ok ? result.data : { salesThisMonth: 0, unpaidTotal: 0, paidThisMonth: 0, vatOutputThisMonth: 0, totalRevenue: 0, totalDocuments: 0, period: '' };
  },

  async getSalesTrend(companyId: string, months = 6): Promise<SalesTrendItem[]> {
    const result = await adapter.getSalesTrend(companyId, months);
    return result.ok ? result.data : [];
  },

  async getTopCustomers(companyId: string, limit = 5): Promise<TopCustomerItem[]> {
    const result = await adapter.getTopCustomers(companyId, limit);
    return result.ok ? result.data : [];
  },

  async getTopProducts(companyId: string, limit = 5): Promise<TopProductItem[]> {
    const result = await adapter.getTopProducts(companyId, limit);
    return result.ok ? result.data : [];
  },

  // --- Settings ---

  async getSetting(key: string): Promise<string | null> {
    const result = await adapter.getSetting(key);
    return result.ok ? result.data : null;
  },

  async setSetting(key: string, value: string) {
    return adapter.setSetting(key, value);
  }
};
