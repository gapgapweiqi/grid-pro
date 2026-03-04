import { Hono } from 'hono';
import type { Env } from '../index';

export const settingsRoutes = new Hono<{ Bindings: Env }>();

/** GET /?scopeType=USER&scopeId=xxx */
settingsRoutes.get('/', async (c) => {
  const scopeType = c.req.query('scopeType') || 'USER';
  const scopeId = c.req.query('scopeId') || c.get('userId' as never) as string;

  const rows = await c.env.DB.prepare(
    `SELECT key, value FROM settings WHERE scope_type = ? AND scope_id = ?`
  ).bind(scopeType, scopeId).all();

  const result: Record<string, string> = {};
  for (const r of rows.results) {
    result[(r as any).key] = (r as any).value;
  }

  return c.json({ ok: true, data: result });
});

/** PUT / — Upsert settings */
settingsRoutes.put('/', async (c) => {
  const body = await c.req.json();
  const scopeType = body.scopeType || 'USER';
  const scopeId = body.scopeId || c.get('userId' as never) as string;
  const entries: Record<string, string> = body.entries || {};
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(entries)) {
    await c.env.DB.prepare(`
      INSERT INTO settings (key, scope_type, scope_id, value, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key, scope_type, scope_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(key, scopeType, scopeId, value, now).run();
  }

  return c.json({ ok: true, data: { updated: Object.keys(entries).length } });
});
