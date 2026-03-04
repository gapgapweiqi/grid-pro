import { Hono } from 'hono';
import type { Env } from '../index';

export const kpiRoutes = new Hono<{ Bindings: Env }>();

/** GET /:companyId — Dashboard KPI */
kpiRoutes.get('/:companyId', async (c) => {
  const companyId = c.req.param('companyId');
  const db = c.env.DB;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-31`;

  const [salesThisMonth, unpaidTotal, paidThisMonth, totalDocs] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(grand_total), 0) as val FROM documents WHERE company_id = ? AND doc_type IN ('INV','RCPT') AND doc_date BETWEEN ? AND ? AND is_deleted = 0`).bind(companyId, monthStart, monthEnd).first(),
    db.prepare(`SELECT COALESCE(SUM(grand_total), 0) as val FROM documents WHERE company_id = ? AND payment_status = 'UNPAID' AND is_deleted = 0`).bind(companyId).first(),
    db.prepare(`SELECT COALESCE(SUM(grand_total), 0) as val FROM documents WHERE company_id = ? AND payment_status = 'PAID' AND doc_date BETWEEN ? AND ? AND is_deleted = 0`).bind(companyId, monthStart, monthEnd).first(),
    db.prepare(`SELECT COUNT(*) as val FROM documents WHERE company_id = ? AND is_deleted = 0`).bind(companyId).first(),
  ]);

  const [totalRevenue, vatOutput] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(grand_total), 0) as val FROM documents WHERE company_id = ? AND doc_type IN ('INV','RCPT') AND payment_status = 'PAID' AND is_deleted = 0`).bind(companyId).first(),
    db.prepare(`SELECT COALESCE(SUM(vat_amount), 0) as val FROM documents WHERE company_id = ? AND doc_type IN ('INV','TAX') AND doc_date BETWEEN ? AND ? AND is_deleted = 0`).bind(companyId, monthStart, monthEnd).first(),
  ]);

  return c.json({
    ok: true,
    data: {
      salesThisMonth: (salesThisMonth as any)?.val || 0,
      unpaidTotal: (unpaidTotal as any)?.val || 0,
      paidThisMonth: (paidThisMonth as any)?.val || 0,
      totalDocuments: (totalDocs as any)?.val || 0,
      totalRevenue: (totalRevenue as any)?.val || 0,
      vatOutputThisMonth: (vatOutput as any)?.val || 0,
      period: `${year}-${month}`,
    },
  });
});

/** GET /:companyId/sales-trend — Monthly sales trend */
kpiRoutes.get('/:companyId/sales-trend', async (c) => {
  const companyId = c.req.param('companyId');
  const months = parseInt(c.req.query('months') || '6');
  const db = c.env.DB;

  const rows = await db.prepare(`
    SELECT
      strftime('%Y-%m', doc_date) as period,
      COALESCE(SUM(grand_total), 0) as total
    FROM documents
    WHERE company_id = ? AND doc_type IN ('INV','RCPT') AND is_deleted = 0
      AND doc_date >= date('now', '-' || ? || ' months')
    GROUP BY period
    ORDER BY period ASC
  `).bind(companyId, months).all();

  const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return c.json({
    ok: true,
    data: (rows.results || []).map((r: any) => {
      const m = parseInt((r.period || '').split('-')[1] || '0', 10);
      return {
        month: r.period || '',
        label: m > 0 ? thMonths[m - 1] : r.period || '',
        total: r.total || 0,
      };
    }),
  });
});

/** GET /:companyId/top-customers — Top customers by revenue */
kpiRoutes.get('/:companyId/top-customers', async (c) => {
  const companyId = c.req.param('companyId');
  const limit = parseInt(c.req.query('limit') || '5');
  const db = c.env.DB;

  const rows = await db.prepare(`
    SELECT
      d.customer_id as customerId,
      COALESCE(m.name, json_extract(d.json, '$.customerName'), 'ไม่ระบุ') as name,
      COALESCE(SUM(d.grand_total), 0) as total,
      COUNT(*) as docCount
    FROM documents d
    LEFT JOIN master m ON m.entity_id = d.customer_id AND m.entity_type = 'CUSTOMER'
    WHERE d.company_id = ? AND d.doc_type IN ('INV','RCPT') AND d.is_deleted = 0
    GROUP BY d.customer_id
    ORDER BY total DESC
    LIMIT ?
  `).bind(companyId, limit).all();

  return c.json({
    ok: true,
    data: (rows.results || []).map((r: any) => ({
      customerId: r.customerId || '',
      customerName: r.name || 'ไม่ระบุ',
      total: r.total || 0,
      docCount: r.docCount || 0,
    })),
  });
});

/** GET /:companyId/top-products — Top products by revenue */
kpiRoutes.get('/:companyId/top-products', async (c) => {
  const companyId = c.req.param('companyId');
  const limit = parseInt(c.req.query('limit') || '5');
  const db = c.env.DB;

  const rows = await db.prepare(`
    SELECT
      dl.product_id as productId,
      COALESCE(m.name, dl.name, 'ไม่ระบุ') as name,
      COALESCE(SUM(dl.line_total), 0) as total,
      COALESCE(SUM(dl.qty), 0) as totalQty
    FROM doc_lines dl
    JOIN documents d ON d.doc_id = dl.doc_id
    LEFT JOIN master m ON m.entity_id = dl.product_id AND m.entity_type = 'PRODUCT'
    WHERE d.company_id = ? AND d.doc_type IN ('INV','RCPT') AND d.is_deleted = 0
    GROUP BY dl.product_id
    ORDER BY total DESC
    LIMIT ?
  `).bind(companyId, limit).all();

  return c.json({
    ok: true,
    data: (rows.results || []).map((r: any) => ({
      productId: r.productId || '',
      name: r.name || 'ไม่ระบุ',
      total: r.total || 0,
      totalQty: r.totalQty || 0,
    })),
  });
});
