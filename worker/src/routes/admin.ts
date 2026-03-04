import { Hono } from 'hono';
import type { Env } from '../index';
import { adminGuard } from '../middleware/auth';

export const adminRoutes = new Hono<{ Bindings: Env }>();

// All admin routes require admin guard
adminRoutes.use('*', adminGuard);

/** GET /users — List all users with billing & team info */
adminRoutes.get('/users', async (c) => {
  const db = c.env.DB;
  const rows = await db.prepare(`
    SELECT u.user_id, u.email, u.name, u.avatar_url, u.auth_provider,
           u.is_active, u.is_admin, u.billing_status, u.created_at, u.updated_at
    FROM users u ORDER BY u.created_at DESC
  `).all();

  const users = [];
  for (const row of rows.results as any[]) {
    // Get team members count per user (companies they own)
    const teamCount = await db.prepare(`
      SELECT COUNT(*) as cnt FROM team_members tm
      INNER JOIN master m ON tm.company_id = m.entity_id
      WHERE m.user_id = ? AND m.entity_type = 'COMPANY' AND m.is_deleted = 0
    `).bind(row.user_id).first() as any;

    // Get companies owned
    const companiesOwned = await db.prepare(`
      SELECT entity_id, name FROM master
      WHERE user_id = ? AND entity_type = 'COMPANY' AND is_deleted = 0
    `).bind(row.user_id).all();

    // Get document count
    const docCount = await db.prepare(`
      SELECT COUNT(*) as cnt FROM documents WHERE user_id = ? AND is_deleted = 0
    `).bind(row.user_id).first() as any;

    // Get seat entitlements (TEAM_SEAT)
    const seatEntitlements = await db.prepare(`
      SELECT COALESCE(SUM(granted_seats), 0) as total_seats FROM billing_entitlements
      WHERE user_id = ? AND entitlement_type = 'TEAM_SEAT' AND is_active = 1
    `).bind(row.user_id).first() as any;
    const adminGranted = await db.prepare(`
      SELECT COALESCE(SUM(granted_seats), 0) as total_seats FROM billing_entitlements
      WHERE user_id = ? AND entitlement_type = 'TEAM_SEAT' AND is_active = 1 AND source = 'ADMIN_OVERRIDE'
    `).bind(row.user_id).first() as any;

    users.push({
      userId: row.user_id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url || '',
      authProvider: row.auth_provider,
      isActive: !!row.is_active,
      isAdmin: !!row.is_admin,
      billingStatus: row.billing_status || 'UNPAID',
      teamMemberCount: teamCount?.cnt || 0,
      documentCount: docCount?.cnt || 0,
      paidSeats: seatEntitlements?.total_seats || 0,
      adminGrantedSeats: adminGranted?.total_seats || 0,
      companies: (companiesOwned.results || []).map((c: any) => ({
        companyId: c.entity_id,
        name: c.name,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  return c.json({ ok: true, data: users });
});

/** PATCH /users/:id/status — Update user billing_status or is_active */
adminRoutes.patch('/users/:id/status', async (c) => {
  const targetUserId = c.req.param('id');
  const body = await c.req.json();
  const now = new Date().toISOString();
  const db = c.env.DB;

  if (body.billingStatus !== undefined) {
    await db.prepare('UPDATE users SET billing_status = ?, updated_at = ? WHERE user_id = ?')
      .bind(body.billingStatus, now, targetUserId).run();
  }
  if (body.isActive !== undefined) {
    await db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE user_id = ?')
      .bind(body.isActive ? 1 : 0, now, targetUserId).run();
  }
  if (body.isAdmin !== undefined) {
    await db.prepare('UPDATE users SET is_admin = ?, updated_at = ? WHERE user_id = ?')
      .bind(body.isAdmin ? 1 : 0, now, targetUserId).run();
  }

  const updated = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(targetUserId).first() as any;
  return c.json({
    ok: true,
    data: {
      userId: updated.user_id,
      email: updated.email,
      name: updated.name,
      isActive: !!updated.is_active,
      isAdmin: !!updated.is_admin,
      billingStatus: updated.billing_status || 'UNPAID',
    },
  });
});

/** POST /users/:id/grant-seats — Admin grants team seats to a user */
adminRoutes.post('/users/:id/grant-seats', async (c) => {
  const targetUserId = c.req.param('id');
  const body = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  const seats = parseInt(body.seats, 10);
  if (!seats || seats < 1 || seats > 10) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'seats ต้องอยู่ระหว่าง 1-10' } }, 400);
  }

  // Verify target user exists
  const targetUser = await db.prepare('SELECT user_id, email, name FROM users WHERE user_id = ?').bind(targetUserId).first() as any;
  if (!targetUser) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } }, 404);
  }

  // Check current total seats for this user (enforce MAX_TEAM = 10)
  const MAX_TEAM = 10;
  const FREE_SEATS = 2;
  const currentEntitlements = await db.prepare(`
    SELECT COALESCE(SUM(granted_seats), 0) as total_seats FROM billing_entitlements
    WHERE user_id = ? AND entitlement_type = 'TEAM_SEAT' AND is_active = 1
  `).bind(targetUserId).first() as any;
  const currentPaidSeats = currentEntitlements?.total_seats || 0;
  const totalAfterGrant = FREE_SEATS + currentPaidSeats + seats;

  if (totalAfterGrant > MAX_TEAM) {
    const maxCanGrant = MAX_TEAM - FREE_SEATS - currentPaidSeats;
    return c.json({
      ok: false,
      error: {
        code: 'LIMIT_REACHED',
        message: `เพิ่มได้สูงสุดอีก ${Math.max(0, maxCanGrant)} ที่นั่ง (ฟรี ${FREE_SEATS} + มีแล้ว ${currentPaidSeats} + เพิ่ม ${seats} = ${totalAfterGrant} > สูงสุด ${MAX_TEAM})`,
      },
    }, 400);
  }

  // Insert entitlement with ADMIN_OVERRIDE source
  const entitlementId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO billing_entitlements (entitlement_id, user_id, company_id, entitlement_type, granted_seats, source, order_id, is_active, created_at, updated_at)
    VALUES (?, ?, '', 'TEAM_SEAT', ?, 'ADMIN_OVERRIDE', '', 1, ?, ?)
  `).bind(entitlementId, targetUserId, seats, now, now).run();

  return c.json({
    ok: true,
    data: {
      entitlementId,
      userId: targetUserId,
      grantedSeats: seats,
      totalPaidSeats: currentPaidSeats + seats,
      totalAvailable: FREE_SEATS + currentPaidSeats + seats,
    },
  });
});

/** GET /coupons — List all coupons */
adminRoutes.get('/coupons', async (c) => {
  const db = c.env.DB;
  const rows = await db.prepare('SELECT * FROM billing_coupons ORDER BY created_at DESC').all();
  return c.json({
    ok: true,
    data: (rows.results || []).map((r: any) => ({
      couponId: r.coupon_id,
      code: r.code,
      description: r.description,
      discountType: r.discount_type,
      discountValue: r.discount_value,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      minAmount: r.min_amount,
      applicableProducts: r.applicable_products,
      startsAt: r.starts_at,
      expiresAt: r.expires_at,
      isActive: !!r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
});

/** POST /coupons — Create a coupon */
adminRoutes.post('/coupons', async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  if (!body.code?.trim()) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'กรุณากรอกรหัสคูปอง' } }, 400);
  }

  // Check duplicate code
  const existing = await db.prepare('SELECT coupon_id FROM billing_coupons WHERE code = ? COLLATE NOCASE')
    .bind(body.code.trim()).first();
  if (existing) {
    return c.json({ ok: false, error: { code: 'DUPLICATE', message: 'รหัสคูปองนี้มีอยู่แล้ว' } }, 400);
  }

  const couponId = 'coupon_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await db.prepare(`
    INSERT INTO billing_coupons (coupon_id, code, description, discount_type, discount_value, max_uses, min_amount, applicable_products, starts_at, expires_at, is_active, used_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
  `).bind(
    couponId,
    body.code.trim().toUpperCase(),
    body.description || '',
    body.discountType || 'PERCENT',
    body.discountValue || 0,
    body.maxUses || null,
    body.minAmount || 0,
    body.applicableProducts || '',
    body.startsAt || '',
    body.expiresAt || '',
    now, now
  ).run();

  return c.json({ ok: true, data: { couponId, code: body.code.trim().toUpperCase() } });
});

/** PATCH /coupons/:id — Update a coupon */
adminRoutes.patch('/coupons/:id', async (c) => {
  const couponId = c.req.param('id');
  const body = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  const existing = await db.prepare('SELECT * FROM billing_coupons WHERE coupon_id = ?').bind(couponId).first() as any;
  if (!existing) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'ไม่พบคูปอง' } }, 404);
  }

  await db.prepare(`
    UPDATE billing_coupons SET
      code = ?, description = ?, discount_type = ?, discount_value = ?,
      max_uses = ?, min_amount = ?, applicable_products = ?,
      starts_at = ?, expires_at = ?, is_active = ?, updated_at = ?
    WHERE coupon_id = ?
  `).bind(
    (body.code || existing.code).trim().toUpperCase(),
    body.description ?? existing.description,
    body.discountType || existing.discount_type,
    body.discountValue ?? existing.discount_value,
    body.maxUses ?? existing.max_uses,
    body.minAmount ?? existing.min_amount,
    body.applicableProducts ?? existing.applicable_products,
    body.startsAt ?? existing.starts_at,
    body.expiresAt ?? existing.expires_at,
    body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
    now,
    couponId
  ).run();

  return c.json({ ok: true, data: { couponId } });
});

/** DELETE /coupons/:id — Delete a coupon */
adminRoutes.delete('/coupons/:id', async (c) => {
  const couponId = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM billing_coupons WHERE coupon_id = ?').bind(couponId).run();
  return c.json({ ok: true });
});

// ─── App Releases Management ─────────────────────────────────

/** GET /releases — List all app releases */
adminRoutes.get('/releases', async (c) => {
  const db = c.env.DB;
  const rows = await db.prepare('SELECT * FROM app_releases ORDER BY created_at DESC').all();
  return c.json({
    ok: true,
    data: (rows.results || []).map((r: any) => ({
      id: r.id,
      version: r.version,
      target: r.target,
      downloadUrl: r.download_url,
      signature: r.signature,
      notes: r.notes,
      pubDate: r.pub_date,
      isActive: !!r.is_active,
      createdAt: r.created_at,
    })),
  });
});

/** POST /releases — Create a new app release */
adminRoutes.post('/releases', async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  const { version, target, downloadUrl, signature, notes } = body;
  if (!version || !target || !downloadUrl || !signature) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing required fields: version, target, downloadUrl, signature' } }, 400);
  }

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO app_releases (id, version, target, download_url, signature, notes, pub_date, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).bind(id, version, target, downloadUrl, signature, notes || '', now, now).run();

  return c.json({ ok: true, data: { id, version, target } });
});

/** PATCH /releases/:id — Toggle active status */
adminRoutes.patch('/releases/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = c.env.DB;

  const existing = await db.prepare('SELECT id FROM app_releases WHERE id = ?').bind(id).first();
  if (!existing) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Release not found' } }, 404);
  }

  if (body.isActive !== undefined) {
    await db.prepare('UPDATE app_releases SET is_active = ? WHERE id = ?')
      .bind(body.isActive ? 1 : 0, id).run();
  }
  if (body.notes !== undefined) {
    await db.prepare('UPDATE app_releases SET notes = ? WHERE id = ?')
      .bind(body.notes, id).run();
  }

  return c.json({ ok: true, data: { id } });
});

/** DELETE /releases/:id — Delete a release */
adminRoutes.delete('/releases/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM app_releases WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

/** GET /kpi — Admin KPI dashboard data */
adminRoutes.get('/kpi', async (c) => {
  const db = c.env.DB;

  const totalUsers = await db.prepare('SELECT COUNT(*) as cnt FROM users').first() as any;
  const activeUsers = await db.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1').first() as any;
  const paidUsers = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE billing_status = 'PAID'").first() as any;
  const unpaidUsers = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE billing_status != 'PAID' OR billing_status IS NULL").first() as any;
  const totalDocs = await db.prepare('SELECT COUNT(*) as cnt FROM documents WHERE is_deleted = 0').first() as any;
  const totalCompanies = await db.prepare("SELECT COUNT(*) as cnt FROM master WHERE entity_type = 'COMPANY' AND is_deleted = 0").first() as any;
  const totalTeamMembers = await db.prepare('SELECT COUNT(*) as cnt FROM team_members').first() as any;

  // Revenue from billing
  const revenue = await db.prepare("SELECT COALESCE(SUM(amount_thb), 0) as total FROM billing_orders WHERE status = 'PAID'").first() as any;

  // Recent signups (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentSignups = await db.prepare('SELECT COUNT(*) as cnt FROM users WHERE created_at >= ?').bind(thirtyDaysAgo).first() as any;

  return c.json({
    ok: true,
    data: {
      totalUsers: totalUsers?.cnt || 0,
      activeUsers: activeUsers?.cnt || 0,
      paidUsers: paidUsers?.cnt || 0,
      unpaidUsers: unpaidUsers?.cnt || 0,
      totalDocuments: totalDocs?.cnt || 0,
      totalCompanies: totalCompanies?.cnt || 0,
      totalTeamMembers: totalTeamMembers?.cnt || 0,
      totalRevenue: revenue?.total || 0,
      recentSignups: recentSignups?.cnt || 0,
    },
  });
});
