/**
 * RemoteStorageAdapter — StorageAdapter backed by the Cloudflare Worker API.
 * Uses JWT auth token from localStorage for all requests.
 * Replaces InMemoryAdapter when a real user is logged in.
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth.token');
}

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<{ ok: boolean; data?: T; error?: { code: string; message: string } }> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  try {
    return JSON.parse(text) as any;
  } catch {
    return { ok: false, error: { code: 'PARSE_ERROR', message: text.slice(0, 200) } };
  }
}

// ===== Helpers =====

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function err<T>(code: string, message: string): ApiResult<T> {
  return { ok: false, error: { code, message } };
}

function pageMeta(total: number, limit: number, offset: number): PageMeta {
  return { total, limit, offset, hasMore: offset + limit < total };
}

function entityTypeToPath(type: EntityType): string {
  return type.toLowerCase();
}

// ===== Remote Adapter =====

export const remoteAdapter: StorageAdapter = {

  // --- Bootstrap ---

  async bootstrap(): Promise<ApiResult<BootstrapData>> {
    const res = await apiFetch('/api/bootstrap');
    if (res.ok && res.data) {
      return ok(res.data as any);
    }
    return err('BOOTSTRAP_FAIL', res.error?.message || 'Bootstrap failed');
  },

  async bootstrapCompany(companyId: string): Promise<ApiResult<CompanyBootstrapData>> {
    const res = await apiFetch(`/api/bootstrap/${companyId}`);
    if (res.ok && res.data) {
      return ok(res.data as any);
    }
    return err('BOOTSTRAP_FAIL', res.error?.message || 'Company bootstrap failed');
  },

  // --- Master Data CRUD ---

  async masterList<T extends MasterEntity>(entityType: EntityType, query: ListQuery): Promise<ApiResult<{ items: T[]; meta: PageMeta }>> {
    const path = entityTypeToPath(entityType);
    const res = await apiFetch(`/api/master/${path}?companyId=${query.companyId}`);
    if (res.ok && res.data) {
      const items = Array.isArray(res.data) ? res.data : [];
      return ok({ items: items as T[], meta: pageMeta(items.length, query.limit || 100, query.offset || 0) });
    }
    return err('LIST_FAIL', res.error?.message || 'List failed');
  },

  async masterGet<T extends MasterEntity>(entityType: EntityType, entityId: string): Promise<ApiResult<T>> {
    // The Worker API doesn't have a single-get for master entities, so we list and filter
    // This is a workaround — in production, add a GET /:type/:id route
    // For now, we search through all items of that type across companies
    // We'll use a trick: fetch all and find by entityId
    const path = entityTypeToPath(entityType);
    // We don't know companyId here, so we use a broader approach
    // Check if any stored companyId is available
    const companyId = typeof window !== 'undefined' ? localStorage.getItem('currentCompanyId') || '' : '';
    if (companyId) {
      const res = await apiFetch(`/api/master/${path}?companyId=${companyId}`);
      if (res.ok && res.data) {
        const items = Array.isArray(res.data) ? res.data : [];
        const found = items.find((item: any) => item.entityId === entityId);
        if (found) return ok(found as T);
      }
    }
    return err('NOT_FOUND', 'Entity not found');
  },

  async masterUpsert<T extends MasterEntity>(entityType: EntityType, payload: Partial<T> & { entityId?: string; companyId: string }): Promise<ApiResult<T>> {
    const path = entityTypeToPath(entityType);
    const res = await apiFetch(`/api/master/${path}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok && res.data) {
      return ok(res.data as T);
    }
    return err('UPSERT_FAIL', res.error?.message || 'Upsert failed');
  },

  async masterDelete(entityType: EntityType, ids: string[]): Promise<ApiResult<{ deleted: number }>> {
    const path = entityTypeToPath(entityType);
    const res = await apiFetch(`/api/master/${path}`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      return ok({ deleted: ids.length });
    }
    return err('DELETE_FAIL', res.error?.message || 'Delete failed');
  },

  // --- Documents ---

  async docQuery(query: DocQuery): Promise<ApiResult<{ items: DocumentHeader[]; meta: PageMeta }>> {
    let url = `/api/docs?companyId=${query.companyId}`;
    if (query.docType) url += `&docType=${query.docType}`;
    if (query.limit) url += `&limit=${query.limit}`;
    if (query.offset) url += `&offset=${query.offset}`;

    const res = await apiFetch(url);
    if (res.ok && res.data) {
      const items = Array.isArray(res.data) ? res.data : [];
      return ok({ items: items as DocumentHeader[], meta: pageMeta(items.length, query.limit || 50, query.offset || 0) });
    }
    return err('QUERY_FAIL', res.error?.message || 'Query failed');
  },

  async docGet(docId: string): Promise<ApiResult<DocumentWithLines>> {
    const res = await apiFetch(`/api/docs/${docId}`);
    if (res.ok && res.data) {
      return ok(res.data as DocumentWithLines);
    }
    return err('NOT_FOUND', res.error?.message || 'Document not found');
  },

  async docUpsert(header: Partial<DocumentHeader> & { companyId: string }, lines: Partial<DocLine>[]): Promise<ApiResult<DocumentWithLines>> {
    const res = await apiFetch('/api/docs', {
      method: 'POST',
      body: JSON.stringify({ header, lines }),
    });
    if (res.ok && res.data) {
      return ok(res.data as DocumentWithLines);
    }
    return err('UPSERT_FAIL', res.error?.message || 'Document upsert failed');
  },

  async docDelete(docIds: string[]): Promise<ApiResult<{ deleted: number }>> {
    const res = await apiFetch('/api/docs', {
      method: 'DELETE',
      body: JSON.stringify({ ids: docIds }),
    });
    if (res.ok) {
      return ok({ deleted: docIds.length });
    }
    return err('DELETE_FAIL', res.error?.message || 'Delete failed');
  },

  async docUpdateStatus(docId: string, field: 'paymentStatus' | 'docStatus', value: string, extra?: Record<string, any>): Promise<ApiResult<DocumentHeader>> {
    const body: Record<string, any> = { ...extra };
    body[field] = value;
    const res = await apiFetch(`/api/docs/${docId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.ok && res.data) {
      return ok(res.data as DocumentHeader);
    }
    return err('UPDATE_FAIL', res.error?.message || 'Status update failed');
  },

  // --- KPI / Dashboard ---

  async getKpi(companyId: string): Promise<ApiResult<KpiData>> {
    const res = await apiFetch(`/api/kpi/${companyId}`);
    if (res.ok && res.data) {
      return ok(res.data as KpiData);
    }
    return ok({ salesThisMonth: 0, unpaidTotal: 0, paidThisMonth: 0, vatOutputThisMonth: 0, totalRevenue: 0, totalDocuments: 0, period: '' });
  },

  async getSalesTrend(companyId: string, months = 6): Promise<ApiResult<SalesTrendItem[]>> {
    const res = await apiFetch(`/api/kpi/${companyId}/sales-trend?months=${months}`);
    if (res.ok && res.data) return ok(res.data as SalesTrendItem[]);
    return ok([]);
  },

  async getTopCustomers(companyId: string, limit = 5): Promise<ApiResult<TopCustomerItem[]>> {
    const res = await apiFetch(`/api/kpi/${companyId}/top-customers?limit=${limit}`);
    if (res.ok && res.data) return ok(res.data as TopCustomerItem[]);
    return ok([]);
  },

  async getTopProducts(companyId: string, limit = 5): Promise<ApiResult<TopProductItem[]>> {
    const res = await apiFetch(`/api/kpi/${companyId}/top-products?limit=${limit}`);
    if (res.ok && res.data) return ok(res.data as TopProductItem[]);
    return ok([]);
  },

  // --- Settings ---

  async getSetting(key: string, scopeType = 'USER', scopeId?: string): Promise<ApiResult<string | null>> {
    let url = `/api/settings?scopeType=${scopeType}`;
    if (scopeId) url += `&scopeId=${scopeId}`;
    const res = await apiFetch(url);
    if (res.ok && res.data) {
      const settings = res.data as Record<string, string>;
      return ok(settings[key] ?? null);
    }
    return ok(null);
  },

  async setSetting(key: string, value: string, scopeType = 'USER', scopeId?: string): Promise<ApiResult<void>> {
    const res = await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ entries: { [key]: value }, scopeType, scopeId }),
    });
    if (res.ok) return ok(undefined as any);
    return err('SETTING_FAIL', res.error?.message || 'Setting save failed');
  },
};
