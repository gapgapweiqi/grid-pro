import { Hono } from 'hono';
import type { Env } from '../index';
import { notifyCompanyOwner } from '../lib/push-helpers';

export const teamRoutes = new Hono<{ Bindings: Env }>();

/** GET /?companyId=xxx — List team members */
teamRoutes.get('/', async (c) => {
  const companyId = c.req.query('companyId');
  if (!companyId) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing companyId' } }, 400);

  const rows = await c.env.DB.prepare(
    `SELECT * FROM team_members WHERE company_id = ? ORDER BY created_at`
  ).bind(companyId).all();

  return c.json({ ok: true, data: rows.results.map(mapTeamRow) });
});

/** GET /all — List all team members across all owner's companies (grouped by email) */
teamRoutes.get('/all', async (c) => {
  const userId = c.get('userId' as never) as string;
  // Get all companies owned by this user
  const companies = await c.env.DB.prepare(
    `SELECT entity_id, name FROM master WHERE entity_type = 'COMPANY' AND user_id = ? AND is_deleted = 0`
  ).bind(userId).all();
  const companyIds = (companies.results || []).map((r: any) => r.entity_id);
  if (companyIds.length === 0) return c.json({ ok: true, data: [] });

  const placeholders = companyIds.map(() => '?').join(',');
  const rows = await c.env.DB.prepare(
    `SELECT * FROM team_members WHERE company_id IN (${placeholders}) ORDER BY email, created_at`
  ).bind(...companyIds).all();

  // Group by email → aggregate companyIds
  const byEmail = new Map<string, { member: any; companyIds: string[] }>();
  for (const row of (rows.results || [])) {
    const r = row as any;
    const key = r.email;
    if (!byEmail.has(key)) {
      byEmail.set(key, { member: mapTeamRow(r), companyIds: [r.company_id] });
    } else {
      byEmail.get(key)!.companyIds.push(r.company_id);
    }
  }

  const result = [...byEmail.values()].map(v => ({
    ...v.member,
    companyIds: v.companyIds,
  }));

  return c.json({ ok: true, data: result });
});

/** GET /seat-info — Get seat usage info for the current user */
teamRoutes.get('/seat-info', async (c) => {
  const userId = c.get('userId' as never) as string;
  const companyId = c.req.query('companyId') || '';
  const MAX_TEAM = 10;
  const FREE_SEATS = 2;

  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM team_members WHERE company_id = ?`
  ).bind(companyId).first() as any;
  const currentCount = count?.cnt || 0;

  const entitlements = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(granted_seats), 0) as total_seats FROM billing_entitlements
     WHERE user_id = ? AND entitlement_type = 'TEAM_SEAT' AND is_active = 1`
  ).bind(userId).first() as any;
  const paidSeats = entitlements?.total_seats || 0;

  const totalAvailable = FREE_SEATS + paidSeats;
  const remaining = Math.min(MAX_TEAM, totalAvailable) - currentCount;

  return c.json({
    ok: true,
    data: {
      currentCount,
      freeSeats: FREE_SEATS,
      paidSeats,
      maxTeam: MAX_TEAM,
      totalAvailable: Math.min(MAX_TEAM, totalAvailable),
      remaining: Math.max(0, remaining),
      needsPayment: remaining <= 0 && currentCount < MAX_TEAM,
    }
  });
});

/** POST / — Add team member (create invite, supports multi-company) */
teamRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const userId = c.get('userId' as never) as string;
  const now = new Date().toISOString();
  const MAX_TEAM = 10;
  const FREE_SEATS = 2;

  // Support both companyId (single) and companyIds (array)
  const companyIds: string[] = body.companyIds?.length ? body.companyIds : (body.companyId ? [body.companyId] : []);
  if (companyIds.length === 0) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing companyId or companyIds' } }, 400);
  }

  // Check seat limits for the first company (primary)
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM team_members WHERE company_id = ?`
  ).bind(companyIds[0]).first() as any;
  const currentCount = count?.cnt || 0;

  if (currentCount >= MAX_TEAM) {
    return c.json({ ok: false, error: { code: 'LIMIT_REACHED', message: `จำนวนสมาชิกเต็มแล้ว (สูงสุด ${MAX_TEAM} คน)` } }, 400);
  }

  // If exceeding free seats, check if user has paid TEAM_SEAT entitlements
  if (currentCount >= FREE_SEATS) {
    const entitlements = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(granted_seats), 0) as total_seats FROM billing_entitlements
       WHERE user_id = ? AND entitlement_type = 'TEAM_SEAT' AND is_active = 1`
    ).bind(userId).first() as any;
    const paidSeats = entitlements?.total_seats || 0;
    const usedPaidSeats = Math.max(0, currentCount - FREE_SEATS);

    if (usedPaidSeats >= paidSeats) {
      return c.json({
        ok: false,
        error: {
          code: 'PAYMENT_REQUIRED',
          message: `คุณใช้สิทธิ์ฟรี ${FREE_SEATS} คนแล้ว กรุณาซื้อที่นั่งเพิ่มเพื่อเชิญสมาชิก`,
          meta: { currentCount, freeSeats: FREE_SEATS, paidSeats, maxTeam: MAX_TEAM }
        }
      }, 402);
    }
  }

  // Shared invite token for all companies
  const inviteToken = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const memberIds: string[] = [];

  for (const cid of companyIds) {
    const memberId = crypto.randomUUID();
    memberIds.push(memberId);
    await c.env.DB.prepare(`
      INSERT INTO team_members (member_id, company_id, email, name, role, permissions, status, invite_token, invite_expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'member', ?, 'pending', ?, ?, ?, ?)
    `).bind(
      memberId, cid, body.email, body.name || '',
      JSON.stringify(body.permissions || []), inviteToken, expiresAt, now, now
    ).run();
  }

  const row = await c.env.DB.prepare('SELECT * FROM team_members WHERE member_id = ?').bind(memberIds[0]).first();
  return c.json({ ok: true, data: { ...mapTeamRow(row), inviteToken, companyIds, memberIds } });
});

/** POST /invite — Generate invite link */
teamRoutes.post('/invite', async (c) => {
  const { memberId } = await c.req.json();
  const member = await c.env.DB.prepare('SELECT * FROM team_members WHERE member_id = ?').bind(memberId).first() as any;
  if (!member) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);

  return c.json({
    ok: true,
    data: {
      inviteLink: `${c.env.CORS_ORIGIN}/invite/${member.invite_token}`,
      expiresAt: member.invite_expires_at,
    },
  });
});

/** POST /accept — Accept invite (activates ALL rows with same token for multi-company) */
teamRoutes.post('/accept', async (c) => {
  const { token } = await c.req.json();
  const userId = c.get('userId' as never) as string;
  const now = new Date().toISOString();

  // Find all pending rows with this token (multi-company invite shares same token)
  const members = await c.env.DB.prepare(
    `SELECT * FROM team_members WHERE invite_token = ? AND status = 'pending'`
  ).bind(token).all();

  const rows = members.results || [];
  if (rows.length === 0) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired invite' } }, 404);

  const first = rows[0] as any;
  if (new Date(first.invite_expires_at) < new Date()) {
    return c.json({ ok: false, error: { code: 'EXPIRED', message: 'Invite has expired' } }, 400);
  }

  // Activate all rows with this token
  for (const row of rows) {
    await c.env.DB.prepare(`
      UPDATE team_members SET user_id = ?, status = 'active', invite_token = '', updated_at = ? WHERE member_id = ?
    `).bind(userId, now, (row as any).member_id).run();
  }

  const companyIds = rows.map((r: any) => r.company_id);

  // Push notification: notify company owners that a team member accepted the invite
  const memberName = (first as any).name || (first as any).email || 'สมาชิก';
  for (const cid of companyIds) {
    notifyCompanyOwner(c.env, cid, 'teamUpdates', {
      title: 'สมาชิกทีมตอบรับคำเชิญ',
      body: `${memberName} เข้าร่วมทีมเรียบร้อยแล้ว`,
      url: '/account?tab=team',
    }).catch(() => {});
  }

  return c.json({ ok: true, data: { memberId: first.member_id, companyId: first.company_id, companyIds } });
});

/** POST /leave — Team member leaves a team (self-remove) */
teamRoutes.post('/leave', async (c) => {
  const userId = c.get('userId' as never) as string;
  const { companyId } = await c.req.json();

  if (!companyId) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing companyId' } }, 400);

  const member = await c.env.DB.prepare(
    `SELECT * FROM team_members WHERE user_id = ? AND company_id = ? AND status = 'active'`
  ).bind(userId, companyId).first() as any;

  if (!member) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Membership not found' } }, 404);

  await c.env.DB.prepare('DELETE FROM team_members WHERE member_id = ?').bind(member.member_id).run();
  return c.json({ ok: true, data: { deleted: member.member_id, companyId } });
});

/** PUT /:id — Update member permissions and/or company access */
teamRoutes.put('/:id', async (c) => {
  const memberId = c.req.param('id');
  const { permissions, status, companyIds } = await c.req.json();
  const now = new Date().toISOString();
  const userId = c.get('userId' as never) as string;

  // Get existing member
  const existing = await c.env.DB.prepare('SELECT * FROM team_members WHERE member_id = ?').bind(memberId).first() as any;
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);

  // Update permissions on this member row
  const updates: string[] = [];
  const params: any[] = [];

  if (permissions) { updates.push('permissions = ?'); params.push(JSON.stringify(permissions)); }
  if (status) { updates.push('status = ?'); params.push(status); }
  updates.push('updated_at = ?'); params.push(now);
  params.push(memberId);

  await c.env.DB.prepare(
    `UPDATE team_members SET ${updates.join(', ')} WHERE member_id = ?`
  ).bind(...params).run();

  // If companyIds provided, sync company access for this member (by email)
  if (companyIds && Array.isArray(companyIds)) {
    const email = existing.email;
    // Get all owner's companies
    const ownerCompanies = await c.env.DB.prepare(
      `SELECT entity_id FROM master WHERE entity_type = 'COMPANY' AND user_id = ? AND is_deleted = 0`
    ).bind(userId).all();
    const ownerCompanyIds = new Set((ownerCompanies.results || []).map((r: any) => r.entity_id));

    // Get all existing memberships for this email across owner's companies
    const existingRows = await c.env.DB.prepare(
      `SELECT member_id, company_id FROM team_members WHERE email = ?`
    ).bind(email).all();
    const existingCompanyIds = new Set((existingRows.results || []).map((r: any) => r.company_id));

    // Add missing companies
    const newPerms = permissions ? JSON.stringify(permissions) : existing.permissions;
    for (const cid of companyIds) {
      if (!ownerCompanyIds.has(cid)) continue; // Only allow owner's companies
      if (!existingCompanyIds.has(cid)) {
        const newMemberId = crypto.randomUUID();
        await c.env.DB.prepare(`
          INSERT INTO team_members (member_id, company_id, user_id, email, name, role, permissions, status, invite_token, invite_expires_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'member', ?, ?, '', '', ?, ?)
        `).bind(
          newMemberId, cid, existing.user_id || '', email, existing.name || '',
          newPerms, existing.status || 'active', now, now
        ).run();
      }
    }

    // Remove companies no longer selected (only from owner's companies)
    for (const row of (existingRows.results || [])) {
      const r = row as any;
      if (ownerCompanyIds.has(r.company_id) && !companyIds.includes(r.company_id)) {
        await c.env.DB.prepare('DELETE FROM team_members WHERE member_id = ?').bind(r.member_id).run();
      }
    }

    // Also update permissions on all remaining rows for this email
    if (permissions) {
      await c.env.DB.prepare(
        `UPDATE team_members SET permissions = ?, updated_at = ? WHERE email = ?`
      ).bind(JSON.stringify(permissions), now, email).run();
    }
  }

  const row = await c.env.DB.prepare('SELECT * FROM team_members WHERE member_id = ?').bind(memberId).first();
  return c.json({ ok: true, data: mapTeamRow(row) });
});

/** GET /my-memberships — Get current user's team memberships */
teamRoutes.get('/my-memberships', async (c) => {
  const userId = c.get('userId' as never) as string;
  const rows = await c.env.DB.prepare(
    `SELECT tm.*, m.name as company_name FROM team_members tm
     LEFT JOIN master m ON m.entity_id = tm.company_id AND m.entity_type = 'COMPANY'
     WHERE tm.user_id = ? AND tm.status = 'active'`
  ).bind(userId).all();
  return c.json({ ok: true, data: (rows.results || []).map((r: any) => ({ ...mapTeamRow(r), companyName: r.company_name || '' })) });
});

/** DELETE /:id — Remove team member */
teamRoutes.delete('/:id', async (c) => {
  const memberId = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM team_members WHERE member_id = ?').bind(memberId).run();
  return c.json({ ok: true, data: { deleted: memberId } });
});

function mapTeamRow(row: any): any {
  if (!row) return null;
  return {
    memberId: row.member_id,
    companyId: row.company_id,
    userId: row.user_id || '',
    email: row.email,
    name: row.name || '',
    role: row.role,
    permissions: safeParseArray(row.permissions),
    status: row.status,
    inviteToken: row.invite_token || '',
    inviteExpiresAt: row.invite_expires_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParseArray(val: any): string[] {
  if (!val || val === '[]') return [];
  try { return JSON.parse(val); } catch { return []; }
}
