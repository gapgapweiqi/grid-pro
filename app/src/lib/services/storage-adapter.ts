/**
 * StorageAdapter interface — single contract for all data stores.
 * Implementations: InMemoryAdapter (dev), D1Adapter (Cloudflare), etc.
 */
import type {
  MasterEntity, EntityType, Company, Customer, Product, Salesperson,
  DocumentHeader, DocLine, DocumentWithLines,
  Setting, AppEvent, FileRecord,
  KpiData, SalesTrendItem, TopCustomerItem, TopProductItem,
  PaymentStatus, DocStatus
} from '$lib/types';

// ===== Standard API Response =====

export interface ApiOk<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErr {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResult<T> = ApiOk<T> | ApiErr;

// ===== Query Types =====

export interface ListQuery {
  companyId: string;
  search?: string;
  status?: string;
  sinceUpdatedAt?: string;
  limit?: number;
  offset?: number;
}

export interface DocQuery extends ListQuery {
  docType?: string;
  paymentStatus?: string;
  docStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
}

export interface PageMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ===== Bootstrap Data =====

export interface BootstrapData {
  companies: Company[];
  settings: Record<string, string>;
}

export interface CompanyBootstrapData {
  customers: Customer[];
  products: Product[];
  salespersons: Salesperson[];
  kpi: KpiData;
  unpaidDocs: DocumentHeader[];
}

// ===== StorageAdapter Interface =====

export interface StorageAdapter {
  // --- Bootstrap ---
  bootstrap(): Promise<ApiResult<BootstrapData>>;
  bootstrapCompany(companyId: string): Promise<ApiResult<CompanyBootstrapData>>;

  // --- Master Data CRUD ---
  masterList<T extends MasterEntity>(entityType: EntityType, query: ListQuery): Promise<ApiResult<{ items: T[]; meta: PageMeta }>>;
  masterGet<T extends MasterEntity>(entityType: EntityType, entityId: string): Promise<ApiResult<T>>;
  masterUpsert<T extends MasterEntity>(entityType: EntityType, payload: Partial<T> & { entityId?: string; companyId: string }): Promise<ApiResult<T>>;
  masterDelete(entityType: EntityType, ids: string[]): Promise<ApiResult<{ deleted: number }>>;

  // --- Documents ---
  docQuery(query: DocQuery): Promise<ApiResult<{ items: DocumentHeader[]; meta: PageMeta }>>;
  docGet(docId: string): Promise<ApiResult<DocumentWithLines>>;
  docUpsert(header: Partial<DocumentHeader> & { companyId: string }, lines: Partial<DocLine>[]): Promise<ApiResult<DocumentWithLines>>;
  docDelete(docIds: string[]): Promise<ApiResult<{ deleted: number }>>;
  docUpdateStatus(docId: string, field: 'paymentStatus' | 'docStatus', value: string, extra?: Record<string, any>): Promise<ApiResult<DocumentHeader>>;

  // --- KPI / Dashboard ---
  getKpi(companyId: string): Promise<ApiResult<KpiData>>;
  getSalesTrend(companyId: string, months?: number): Promise<ApiResult<SalesTrendItem[]>>;
  getTopCustomers(companyId: string, limit?: number): Promise<ApiResult<TopCustomerItem[]>>;
  getTopProducts(companyId: string, limit?: number): Promise<ApiResult<TopProductItem[]>>;

  // --- Settings ---
  getSetting(key: string, scopeType?: string, scopeId?: string): Promise<ApiResult<string | null>>;
  setSetting(key: string, value: string, scopeType?: string, scopeId?: string): Promise<ApiResult<void>>;
}
