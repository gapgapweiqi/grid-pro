import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { masterRoutes } from './routes/master';
import { docRoutes } from './routes/docs';
import { teamRoutes } from './routes/team';
import { settingsRoutes } from './routes/settings';
import { fileRoutes } from './routes/files';
import { emailRoutes } from './routes/email';
import { kpiRoutes } from './routes/kpi';
import { billingRoutes } from './routes/billing';
import { adminRoutes } from './routes/admin';
import { imageRoutes } from './routes/images';
import { pushRoutes } from './routes/push';
import { authMiddleware } from './middleware/auth';

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  CORS_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  LINE_CHANNEL_ID: string;
  LINE_CHANNEL_SECRET: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS — allow multiple origins (dev + production)
app.use('*', async (c, next) => {
  const allowedOrigins = [
    c.env.CORS_ORIGIN || 'http://localhost:5173',
    'http://localhost:5174',
    'https://griddoc-app.pages.dev',
    'https://app.grid-doc.com',
    'https://grid-doc.com',
    'https://www.grid-doc.com',
  ];
  const requestOrigin = c.req.header('Origin') || '';
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  const corsMiddleware = cors({
    origin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Health check
app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// Public routes (no auth required)
app.route('/api/auth', authRoutes);

// Stripe webhook — must be before authMiddleware, no auth required
import { handleStripeWebhook } from './routes/billing';
app.post('/api/billing/webhook', handleStripeWebhook);

// Public push key — no auth required (client needs it to subscribe)
app.get('/api/push/vapid-public-key', (c) => {
  return c.json({ ok: true, data: { publicKey: c.env.VAPID_PUBLIC_KEY || '' } });
});

// Public download serve — no auth required (desktop app installers from R2)
app.get('/api/downloads/*', async (c) => {
  const key = 'downloads/' + c.req.path.replace('/api/downloads/', '');
  if (!key || key === 'downloads/') return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing file' } }, 400);
  const object = await c.env.IMAGES.get(key);
  if (!object) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } }, 404);
  const filename = key.split('/').pop() || 'download';
  const headers = new Headers();
  headers.set('Content-Type', 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(object.body, { headers });
});

// Public image serve — no auth required (immutable URLs with unique keys)
app.get('/api/images/*', async (c) => {
  const key = c.req.path.replace('/api/images/', '');
  if (!key) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing key' } }, 400);
  const object = await c.env.IMAGES.get(key);
  if (!object) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('ETag', object.httpEtag);
  return new Response(object.body, { headers });
});

// Tauri update check — dynamic D1 lookup
app.get('/api/tauri-update/:target/:arch/:current_version', async (c) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
  try {
    const target = c.req.param('target');
    const arch = c.req.param('arch');
    const currentVersion = c.req.param('current_version');
    const targetKey = `${target}-${arch}`;

    const release = await c.env.DB.prepare(
      `SELECT version, download_url, signature, pub_date, notes
       FROM app_releases WHERE target = ? AND is_active = 1
       ORDER BY created_at DESC LIMIT 1`
    ).bind(targetKey).first() as any;

    if (!release) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Simple semver compare: split by dots, compare numerically
    const cur = currentVersion.replace(/^v/, '').split('.').map(Number);
    const rel = release.version.replace(/^v/, '').split('.').map(Number);
    let isNewer = false;
    for (let i = 0; i < Math.max(cur.length, rel.length); i++) {
      const a = rel[i] || 0;
      const b = cur[i] || 0;
      if (a > b) { isNewer = true; break; }
      if (a < b) break;
    }

    if (!isNewer) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return c.json({
      version: release.version,
      url: release.download_url,
      signature: release.signature,
      pub_date: release.pub_date,
      notes: release.notes || '',
    }, 200, corsHeaders);
  } catch (e) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
});

// Protected routes
app.use('/api/*', authMiddleware);
app.route('/api/master', masterRoutes);
app.route('/api/docs', docRoutes);
app.route('/api/team', teamRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/files', fileRoutes);
app.route('/api/email', emailRoutes);
app.route('/api/kpi', kpiRoutes);
app.route('/api/billing', billingRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/images', imageRoutes);
app.route('/api/push', pushRoutes);

// Bootstrap endpoint — returns companies + settings + user profile in single call
app.get('/api/bootstrap', async (c) => {
  const userId = c.get('userId' as never) as string;
  const d1 = c.env.DB;

  // Batch: companies + settings + user profile + team memberships (with permissions) in parallel
  const [ownedCompanies, settings, userRow, teamMemberships] = await Promise.all([
    d1.prepare(
      `SELECT * FROM master WHERE entity_type = 'COMPANY' AND user_id = ? AND is_deleted = 0`
    ).bind(userId).all(),
    d1.prepare(
      `SELECT key, value FROM settings WHERE scope_type = 'USER' AND scope_id = ?`
    ).bind(userId).all(),
    d1.prepare(
      `SELECT user_id, email, name, avatar_url, auth_provider, google_id, drive_folder_id, is_active, is_admin, billing_status, created_at, updated_at FROM users WHERE user_id = ?`
    ).bind(userId).first(),
    d1.prepare(
      `SELECT tm.company_id, tm.permissions FROM team_members tm WHERE tm.user_id = ? AND tm.status = 'active'`
    ).bind(userId).all(),
  ]);

  // Fetch team companies (companies the user was invited to)
  const teamCompanyIds = (teamMemberships.results || []).map((r: any) => r.company_id).filter(Boolean);
  const ownedIds = new Set((ownedCompanies.results || []).map((r: any) => r.entity_id));
  const missingTeamIds = teamCompanyIds.filter((id: string) => !ownedIds.has(id));

  // Build per-company permissions map AND union set
  const teamPermSet = new Set<string>();
  const teamPermissionsMap: Record<string, string[]> = {};
  for (const row of (teamMemberships.results || [])) {
    try {
      const perms = JSON.parse((row as any).permissions || '[]');
      const cid = (row as any).company_id;
      if (Array.isArray(perms)) {
        perms.forEach((p: string) => teamPermSet.add(p));
        if (cid) teamPermissionsMap[cid] = perms;
      }
    } catch { /* skip */ }
  }
  const teamPermissions = [...teamPermSet];

  // Fetch ALL team companies (companies the user was invited to)
  let allTeamCompanyRows: any[] = [];
  if (teamCompanyIds.length > 0) {
    const placeholders = teamCompanyIds.map(() => '?').join(',');
    const res = await d1.prepare(
      `SELECT * FROM master WHERE entity_type = 'COMPANY' AND entity_id IN (${placeholders}) AND is_deleted = 0`
    ).bind(...teamCompanyIds).all();
    allTeamCompanyRows = res.results || [];
  }

  // Also fetch team companies not in owned (for owners who need both)
  const ownedIdSet = new Set((ownedCompanies.results || []).map((r: any) => r.entity_id));
  const extraTeamCompanies = allTeamCompanyRows.filter((r: any) => !ownedIdSet.has(r.entity_id));

  const ownBilling = (userRow as any)?.billing_status || 'UNPAID';
  const userIsOwner = ownBilling === 'PAID';
  // Non-owners with team access: ONLY see team companies (not their own)
  // Owners: see their owned companies + any additional team companies
  const allCompanies = userIsOwner
    ? [...ownedCompanies.results, ...extraTeamCompanies]
    : (teamCompanyIds.length > 0 ? allTeamCompanyRows : [...ownedCompanies.results]);

  // Check if user is a team member of any company owned by a PAID user
  let hasTeamAccess = false;
  if (teamCompanyIds.length > 0) {
    const placeholders = teamCompanyIds.map(() => '?').join(',');
    const paidOwner = await d1.prepare(
      `SELECT u.user_id FROM users u
       JOIN master m ON m.user_id = u.user_id AND m.entity_type = 'COMPANY' AND m.entity_id IN (${placeholders})
       WHERE u.billing_status = 'PAID' LIMIT 1`
    ).bind(...teamCompanyIds).first();
    hasTeamAccess = !!paidOwner;
  }

  const settingsMap: Record<string, string> = {};
  for (const s of settings.results) {
    settingsMap[(s as any).key] = (s as any).value;
  }

  const ownBillingStatus = (userRow as any)?.billing_status || 'UNPAID';
  // isOwner = user has paid for OWNER_ACCESS themselves
  const isOwner = ownBillingStatus === 'PAID';
  const effectiveBillingStatus = isOwner || hasTeamAccess ? 'PAID' : ownBillingStatus;

  const user = userRow ? {
    userId: (userRow as any).user_id,
    email: (userRow as any).email,
    name: (userRow as any).name,
    avatarUrl: (userRow as any).avatar_url || '',
    authProvider: (userRow as any).auth_provider || 'email',
    googleId: (userRow as any).google_id || '',
    driveFolderId: (userRow as any).drive_folder_id || '',
    isActive: !!(userRow as any).is_active,
    isAdmin: !!(userRow as any).is_admin,
    billingStatus: effectiveBillingStatus,
    isOwner,
    hasTeamAccess,
    teamPermissions,
    teamPermissionsMap,
    teamCompanyIds,
    createdAt: (userRow as any).created_at || '',
    updatedAt: (userRow as any).updated_at || '',
  } : null;

  return c.json({
    ok: true,
    data: {
      companies: allCompanies.map(mapMasterRow),
      settings: settingsMap,
      user,
    },
  });
});

// Bootstrap company data
app.get('/api/bootstrap/:companyId', async (c) => {
  const companyId = c.req.param('companyId');
  const db = c.env.DB;

  const [customers, products, salespersons, unpaidDocs] = await Promise.all([
    db.prepare(`SELECT * FROM master WHERE entity_type = 'CUSTOMER' AND company_id = ? AND is_deleted = 0`).bind(companyId).all(),
    db.prepare(`SELECT * FROM master WHERE entity_type = 'PRODUCT' AND company_id = ? AND is_deleted = 0`).bind(companyId).all(),
    db.prepare(`SELECT * FROM master WHERE entity_type = 'SALESPERSON' AND company_id = ? AND is_deleted = 0`).bind(companyId).all(),
    db.prepare(`SELECT * FROM documents WHERE company_id = ? AND payment_status = 'UNPAID' AND is_deleted = 0 ORDER BY doc_date DESC LIMIT 50`).bind(companyId).all(),
  ]);

  return c.json({
    ok: true,
    data: {
      customers: customers.results.map(mapMasterRow),
      products: products.results.map(mapMasterRow),
      salespersons: salespersons.results.map(mapMasterRow),
      unpaidDocs: unpaidDocs.results.map(mapDocRow),
      kpi: { salesThisMonth: 0, unpaidTotal: 0, paidThisMonth: 0, vatOutputThisMonth: 0, totalRevenue: 0, totalDocuments: 0, period: '' },
    },
  });
});

/** Map D1 row (snake_case) to API response (camelCase) for master entities */
export function mapMasterRow(row: any): any {
  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    userId: row.user_id,
    companyId: row.company_id,
    code: row.code || '',
    name: row.name || '',
    name2: row.name2 || '',
    taxId: row.tax_id || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    tags: row.tags || '',
    status: row.status || 'ACTIVE',
    isDeleted: !!row.is_deleted,
    json: safeParseJson(row.json),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

/** Map D1 row to doc header */
export function mapDocRow(row: any): any {
  return {
    docId: row.doc_id,
    docType: row.doc_type,
    userId: row.user_id,
    companyId: row.company_id,
    customerId: row.customer_id || '',
    docNo: row.doc_no || '',
    docDate: row.doc_date || '',
    dueDate: row.due_date || '',
    refDocNo: row.ref_doc_no || '',
    refDocId: row.ref_doc_id || '',
    currency: row.currency || 'THB',
    subtotal: row.subtotal || 0,
    discountEnabled: !!row.discount_enabled,
    discountType: row.discount_type || 'AMOUNT',
    discountValue: row.discount_value || 0,
    vatEnabled: !!row.vat_enabled,
    vatRate: row.vat_rate || 7,
    whtEnabled: !!row.wht_enabled,
    whtRate: row.wht_rate || 3,
    totalBeforeTax: row.total_before_tax || 0,
    vatAmount: row.vat_amount || 0,
    whtAmount: row.wht_amount || 0,
    grandTotal: row.grand_total || 0,
    paymentStatus: row.payment_status || 'UNPAID',
    docStatus: row.doc_status || 'DRAFT',
    notes: row.notes || '',
    terms: row.terms || '',
    signatureEnabled: !!row.signature_enabled,
    pdfFileId: row.pdf_file_id || '',
    isDeleted: !!row.is_deleted,
    json: safeParseJson(row.json),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

export function mapDocLineRow(row: any): any {
  return {
    lineId: row.line_id,
    docId: row.doc_id,
    lineNo: row.line_no || 0,
    productId: row.product_id || '',
    code: row.code || '',
    name: row.name || '',
    description: row.description || '',
    qty: row.qty || 0,
    unit: row.unit || '',
    unitPrice: row.unit_price || 0,
    discountType: row.discount_type || '',
    discountValue: row.discount_value || 0,
    lineTotal: row.line_total || 0,
    json: safeParseJson(row.json),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function safeParseJson(val: any): Record<string, unknown> {
  if (!val || val === '{}') return {};
  try { return JSON.parse(val); } catch { return {}; }
}

// Sync version check — lightweight poll endpoint for multi-device sync
app.get('/api/sync/version', async (c) => {
  const userId = c.get('userId' as never) as string;
  const companyId = c.req.query('companyId') || '';
  const d1 = c.env.DB;

  const queries: Promise<any>[] = [
    d1.prepare('SELECT version, updated_at FROM user_sync_versions WHERE user_id = ?')
      .bind(userId).first(),
  ];
  if (companyId) {
    queries.push(
      d1.prepare('SELECT version, updated_at FROM sync_versions WHERE company_id = ?')
        .bind(companyId).first()
    );
  }

  const results = await Promise.all(queries);
  return c.json({
    ok: true,
    data: {
      userVersion: results[0]?.version || 0,
      userUpdatedAt: results[0]?.updated_at || '',
      companyVersion: results[1]?.version || 0,
      companyUpdatedAt: results[1]?.updated_at || '',
    },
  });
});

// Helper: bump sync version (called from mutation routes)
export async function bumpSyncVersion(db: D1Database, companyId: string, userId?: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO sync_versions (company_id, version, updated_at) VALUES (?, 1, ?)
    ON CONFLICT(company_id) DO UPDATE SET version = version + 1, updated_at = ?
  `).bind(companyId, now, now).run();

  if (userId) {
    await db.prepare(`
      INSERT INTO user_sync_versions (user_id, version, updated_at) VALUES (?, 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET version = version + 1, updated_at = ?
    `).bind(userId, now, now).run();
  }
}

import { handleScheduled } from './scheduled';

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env));
  },
};
