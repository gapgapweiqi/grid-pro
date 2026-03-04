import { Hono } from 'hono';
import type { Env } from '../index';
import { mapMasterRow, bumpSyncVersion } from '../index';

export const masterRoutes = new Hono<{ Bindings: Env }>();

/** GET /:type?companyId=xxx — List master entities by type */
masterRoutes.get('/:type', async (c) => {
  const entityType = c.req.param('type').toUpperCase();
  const userId = c.get('userId' as never) as string;

  // COMPANY entities: return owned + team-member companies
  if (entityType === 'COMPANY') {
    // Owned companies
    const owned = await c.env.DB.prepare(
      `SELECT * FROM master WHERE entity_type = 'COMPANY' AND user_id = ? AND is_deleted = 0 ORDER BY name`
    ).bind(userId).all();

    // Team companies (where user is an active team member)
    const teamRows = await c.env.DB.prepare(
      `SELECT company_id FROM team_members WHERE user_id = ? AND status = 'active'`
    ).bind(userId).all();
    const teamIds = (teamRows.results || []).map((r: any) => r.company_id).filter(Boolean);
    const ownedIds = new Set((owned.results || []).map((r: any) => r.entity_id));
    const missingIds = teamIds.filter((id: string) => !ownedIds.has(id));

    let allResults = [...owned.results];
    if (missingIds.length > 0) {
      const ph = missingIds.map(() => '?').join(',');
      const extra = await c.env.DB.prepare(
        `SELECT * FROM master WHERE entity_type = 'COMPANY' AND entity_id IN (${ph}) AND is_deleted = 0`
      ).bind(...missingIds).all();
      allResults = [...allResults, ...(extra.results || [])];
    }

    return c.json({ ok: true, data: allResults.map(mapMasterRow) });
  }

  const companyId = c.req.query('companyId');
  if (!companyId) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing companyId' } }, 400);

  const rows = await c.env.DB.prepare(
    `SELECT * FROM master WHERE entity_type = ? AND company_id = ? AND is_deleted = 0 ORDER BY name`
  ).bind(entityType, companyId).all();

  return c.json({ ok: true, data: rows.results.map(mapMasterRow) });
});

/** POST /:type — Upsert a master entity */
masterRoutes.post('/:type', async (c) => {
  const entityType = c.req.param('type').toUpperCase();
  const body = await c.req.json();
  const userId = c.get('userId' as never) as string;
  const now = new Date().toISOString();

  const entityId = body.entityId || crypto.randomUUID();
  // For COMPANY entities, company_id = entityId (self-referencing)
  const companyId = entityType === 'COMPANY' ? entityId : (body.companyId || '');
  const existing = await c.env.DB.prepare('SELECT entity_id FROM master WHERE entity_id = ?').bind(entityId).first();

  if (existing) {
    await c.env.DB.prepare(`
      UPDATE master SET name = ?, name2 = ?, code = ?, tax_id = ?, phone = ?, email = ?, address = ?, tags = ?, status = ?, json = ?, company_id = ?, updated_at = ?
      WHERE entity_id = ?
    `).bind(
      body.name || '', body.name2 || '', body.code || '', body.taxId || '',
      body.phone || '', body.email || '', body.address || '', body.tags || '',
      body.status || 'ACTIVE', JSON.stringify(body.json || {}), companyId, now, entityId
    ).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO master (entity_id, entity_type, user_id, company_id, code, name, name2, tax_id, phone, email, address, tags, status, json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entityId, entityType, userId, companyId,
      body.code || '', body.name || '', body.name2 || '', body.taxId || '',
      body.phone || '', body.email || '', body.address || '', body.tags || '',
      body.status || 'ACTIVE', JSON.stringify(body.json || {}), now, now
    ).run();
  }

  const row = await c.env.DB.prepare('SELECT * FROM master WHERE entity_id = ?').bind(entityId).first();

  // Bump sync version for multi-device consistency
  bumpSyncVersion(c.env.DB, companyId, userId).catch(() => {});

  return c.json({ ok: true, data: mapMasterRow(row) });
});

/** DELETE /:type — Soft-delete master entities */
masterRoutes.delete('/:type', async (c) => {
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing ids' } }, 400);
  }

  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB.prepare(
    `UPDATE master SET is_deleted = 1, updated_at = ? WHERE entity_id IN (${placeholders})`
  ).bind(new Date().toISOString(), ...ids).run();

  // Bump sync version
  const userId = c.get('userId' as never) as string;
  bumpSyncVersion(c.env.DB, '', userId).catch(() => {});

  return c.json({ ok: true, data: { deleted: ids.length } });
});
