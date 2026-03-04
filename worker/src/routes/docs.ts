import { Hono } from 'hono';
import type { Env } from '../index';
import { mapDocRow, mapDocLineRow, bumpSyncVersion } from '../index';
import { notifyCompanyOwner } from '../lib/push-helpers';

export const docRoutes = new Hono<{ Bindings: Env }>();

/** GET /?companyId=xxx&docType=INV&limit=50&offset=0 */
docRoutes.get('/', async (c) => {
  const companyId = c.req.query('companyId');
  const docType = c.req.query('docType');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  if (!companyId) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing companyId' } }, 400);

  let sql = `SELECT * FROM documents WHERE company_id = ? AND is_deleted = 0`;
  const params: any[] = [companyId];
  if (docType) { sql += ` AND doc_type = ?`; params.push(docType); }
  sql += ` ORDER BY doc_date DESC, created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ ok: true, data: rows.results.map(mapDocRow) });
});

/** GET /:id/chain — Get linked documents for chain timeline */
docRoutes.get('/:id/chain', async (c) => {
  const docId = c.req.param('id');
  const db = c.env.DB;

  const doc = await db.prepare('SELECT * FROM documents WHERE doc_id = ? AND is_deleted = 0').bind(docId).first() as any;
  if (!doc) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);

  // Find all linked docs: by ref_doc_id (both directions) + refDocNo fallback
  const rows = await db.prepare(`
    SELECT * FROM documents WHERE is_deleted = 0 AND doc_id != ? AND (
      ref_doc_id = ? OR doc_id = ? OR
      (ref_doc_no != '' AND ref_doc_no = ?) OR
      (? != '' AND doc_no = ?)
    ) ORDER BY doc_date ASC, created_at ASC
  `).bind(
    docId,
    docId,
    doc.ref_doc_id || '',
    doc.doc_no,
    doc.ref_doc_no || '', doc.ref_doc_no || ''
  ).all();

  return c.json({ ok: true, data: rows.results.map(mapDocRow) });
});

/** GET /:id — Get doc with lines */
docRoutes.get('/:id', async (c) => {
  const docId = c.req.param('id');
  const doc = await c.env.DB.prepare('SELECT * FROM documents WHERE doc_id = ?').bind(docId).first();
  if (!doc) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);

  const lines = await c.env.DB.prepare('SELECT * FROM doc_lines WHERE doc_id = ? ORDER BY line_no').bind(docId).all();

  return c.json({
    ok: true,
    data: {
      header: mapDocRow(doc),
      lines: lines.results.map(mapDocLineRow),
    },
  });
});

/** POST / — Upsert document with lines */
docRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const userId = c.get('userId' as never) as string;
  const now = new Date().toISOString();
  const db = c.env.DB;

  const docId = body.header?.docId || crypto.randomUUID();
  const h = body.header || {};

  const existing = await db.prepare('SELECT doc_id FROM documents WHERE doc_id = ?').bind(docId).first();

  if (existing) {
    const refDocId = h.json?.refDocId || '';
    await db.prepare(`
      UPDATE documents SET doc_type=?, customer_id=?, doc_no=?, doc_date=?, due_date=?, ref_doc_no=?, ref_doc_id=?, currency=?,
      subtotal=?, discount_enabled=?, discount_type=?, discount_value=?, vat_enabled=?, vat_rate=?,
      wht_enabled=?, wht_rate=?, total_before_tax=?, vat_amount=?, wht_amount=?, grand_total=?,
      payment_status=?, doc_status=?, notes=?, terms=?, signature_enabled=?, json=?, updated_at=?
      WHERE doc_id = ?
    `).bind(
      h.docType || '', h.customerId || '', h.docNo || '', h.docDate || '', h.dueDate || '',
      h.refDocNo || '', refDocId, h.currency || 'THB', h.subtotal || 0,
      h.discountEnabled ? 1 : 0, h.discountType || 'AMOUNT', h.discountValue || 0,
      h.vatEnabled ? 1 : 0, h.vatRate || 7, h.whtEnabled ? 1 : 0, h.whtRate || 3,
      h.totalBeforeTax || 0, h.vatAmount || 0, h.whtAmount || 0, h.grandTotal || 0,
      h.paymentStatus || 'UNPAID', h.docStatus || 'DRAFT',
      h.notes || '', h.terms || '', h.signatureEnabled ? 1 : 0,
      JSON.stringify(h.json || {}), now, docId
    ).run();
  } else {
    const refDocId = h.json?.refDocId || '';
    await db.prepare(`
      INSERT INTO documents (doc_id, doc_type, user_id, company_id, customer_id, doc_no, doc_date, due_date,
      ref_doc_no, ref_doc_id, currency, subtotal, discount_enabled, discount_type, discount_value, vat_enabled, vat_rate,
      wht_enabled, wht_rate, total_before_tax, vat_amount, wht_amount, grand_total,
      payment_status, doc_status, notes, terms, signature_enabled, json, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      docId, h.docType || '', userId, h.companyId || '', h.customerId || '',
      h.docNo || '', h.docDate || '', h.dueDate || '', h.refDocNo || '', refDocId, h.currency || 'THB',
      h.subtotal || 0, h.discountEnabled ? 1 : 0, h.discountType || 'AMOUNT', h.discountValue || 0,
      h.vatEnabled ? 1 : 0, h.vatRate || 7, h.whtEnabled ? 1 : 0, h.whtRate || 3,
      h.totalBeforeTax || 0, h.vatAmount || 0, h.whtAmount || 0, h.grandTotal || 0,
      h.paymentStatus || 'UNPAID', h.docStatus || 'DRAFT',
      h.notes || '', h.terms || '', h.signatureEnabled ? 1 : 0,
      JSON.stringify(h.json || {}), now, now
    ).run();
  }

  // Upsert lines: delete all then re-insert
  if (Array.isArray(body.lines)) {
    await db.prepare('DELETE FROM doc_lines WHERE doc_id = ?').bind(docId).run();
    for (let i = 0; i < body.lines.length; i++) {
      const l = body.lines[i];
      await db.prepare(`
        INSERT INTO doc_lines (line_id, doc_id, line_no, product_id, code, name, description, qty, unit, unit_price, discount_type, discount_value, line_total, json, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        l.lineId || crypto.randomUUID(), docId, i + 1,
        l.productId || '', l.code || '', l.name || '', l.description || '',
        l.qty || 0, l.unit || '', l.unitPrice || 0,
        l.discountType || '', l.discountValue || 0, l.lineTotal || 0,
        JSON.stringify(l.json || {}), now, now
      ).run();
    }
  }

  // Update sequence
  if (h.docNo && h.companyId && h.docType) {
    const seqId = `${h.docType}:${h.companyId}`;
    const numMatch = h.docNo.match(/(\d+)$/);
    if (numMatch) {
      const val = parseInt(numMatch[1]);
      await db.prepare(`
        INSERT INTO sequences (id, current_value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET current_value = MAX(current_value, excluded.current_value), updated_at = excluded.updated_at
      `).bind(seqId, val, now).run();
    }
  }

  const doc = await db.prepare('SELECT * FROM documents WHERE doc_id = ?').bind(docId).first();
  const lines = await db.prepare('SELECT * FROM doc_lines WHERE doc_id = ? ORDER BY line_no').bind(docId).all();

  // Bump sync version for multi-device consistency
  bumpSyncVersion(db, h.companyId || '', userId).catch(() => {});

  // Push notification: notify company owner when a team member creates a new document
  if (!existing && h.companyId) {
    notifyCompanyOwner(c.env, h.companyId, 'docUpdates', {
      title: `เอกสารใหม่: ${h.docNo || docId.slice(0, 8)}`,
      body: `สร้าง${h.docType || 'เอกสาร'} ${h.docNo || ''} สำเร็จ`,
      url: `/documents/${docId}`,
    }).catch(() => {});
  }

  return c.json({ ok: true, data: { header: mapDocRow(doc), lines: lines.results.map(mapDocLineRow) } });
});

/** PATCH /:id/status — Update payment or doc status (+ optional paymentMethod in json) */
docRoutes.patch('/:id/status', async (c) => {
  const docId = c.req.param('id');
  const { paymentStatus, docStatus, paymentMethod } = await c.req.json();
  const now = new Date().toISOString();

  if (paymentStatus) {
    await c.env.DB.prepare('UPDATE documents SET payment_status = ?, updated_at = ? WHERE doc_id = ?').bind(paymentStatus, now, docId).run();
  }
  if (docStatus) {
    await c.env.DB.prepare('UPDATE documents SET doc_status = ?, updated_at = ? WHERE doc_id = ?').bind(docStatus, now, docId).run();
  }
  if (paymentMethod !== undefined) {
    // Merge paymentMethod into the existing json column
    const existing = await c.env.DB.prepare('SELECT json FROM documents WHERE doc_id = ?').bind(docId).first();
    const jsonObj = existing?.json ? (typeof existing.json === 'string' ? JSON.parse(existing.json) : existing.json) : {};
    jsonObj.paymentMethod = paymentMethod;
    await c.env.DB.prepare('UPDATE documents SET json = ?, updated_at = ? WHERE doc_id = ?').bind(JSON.stringify(jsonObj), now, docId).run();
  }

  const doc = await c.env.DB.prepare('SELECT * FROM documents WHERE doc_id = ?').bind(docId).first();

  // Bump sync version
  const companyId = (doc as any)?.company_id || '';
  const userId = c.get('userId' as never) as string;
  bumpSyncVersion(c.env.DB, companyId, userId).catch(() => {});

  return c.json({ ok: true, data: mapDocRow(doc) });
});

/** DELETE / — Soft-delete documents */
docRoutes.delete('/', async (c) => {
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing ids' } }, 400);
  }

  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB.prepare(
    `UPDATE documents SET is_deleted = 1, updated_at = ? WHERE doc_id IN (${placeholders})`
  ).bind(new Date().toISOString(), ...ids).run();

  // Bump sync version
  const userId = c.get('userId' as never) as string;
  bumpSyncVersion(c.env.DB, '', userId).catch(() => {});

  return c.json({ ok: true, data: { deleted: ids.length } });
});
