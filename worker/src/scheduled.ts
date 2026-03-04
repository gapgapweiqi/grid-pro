/**
 * Scheduled (cron) triggers for push notifications.
 * - Overdue document reminders
 * - Daily summary
 */

import type { Env } from './index';
import { notifyUser } from './lib/push-helpers';

/**
 * Main scheduled handler — called by Cloudflare cron triggers.
 * Configure in wrangler.toml:
 *   [triggers]
 *   crons = ["0 1 * * *"]   # 08:00 Bangkok (UTC+7)
 */
export async function handleScheduled(env: Env): Promise<void> {
  await Promise.allSettled([
    sendOverdueReminders(env),
    sendDailySummaries(env),
  ]);
}

/**
 * Send overdue reminders to company owners who have documents past due date.
 * Category: "overdueReminders"
 */
async function sendOverdueReminders(env: Env): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Find all companies with overdue documents (unpaid/partial, due_date < today)
    const rows = await env.DB.prepare(`
      SELECT company_id, COUNT(*) as cnt, SUM(grand_total) as total
      FROM documents
      WHERE is_deleted = 0
        AND payment_status IN ('UNPAID', 'PARTIAL')
        AND due_date != ''
        AND due_date < ?
      GROUP BY company_id
    `).bind(today).all();

    if (!rows.results?.length) return;

    for (const row of rows.results as any[]) {
      const companyId = row.company_id;
      const cnt = row.cnt || 0;
      const total = row.total || 0;

      // Find company owner
      const company = await env.DB.prepare(
        `SELECT user_id FROM master WHERE entity_id = ? AND entity_type = 'COMPANY'`
      ).bind(companyId).first();

      if (!company?.user_id) continue;

      const formattedTotal = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(total);

      await notifyUser(env, company.user_id as string, 'overdueReminders', {
        title: `เอกสารเกินกำหนด ${cnt} รายการ`,
        body: `ยอดรวม ฿${formattedTotal} — กรุณาติดตามการชำระเงิน`,
        url: '/payments?status=OVERDUE',
      });
    }
  } catch (e) {
    console.error('[scheduled] sendOverdueReminders error:', e);
  }
}

/**
 * Send daily summary to users who opted in (dailySummary preference).
 * Category: "dailySummary"
 */
async function sendDailySummaries(env: Env): Promise<void> {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Find users who have dailySummary enabled
    const prefRows = await env.DB.prepare(
      `SELECT user_id, preferences FROM push_preferences`
    ).all();

    if (!prefRows.results?.length) return;

    for (const prefRow of prefRows.results as any[]) {
      try {
        const prefs = JSON.parse(prefRow.preferences || '{}');
        if (!prefs.dailySummary) continue;
      } catch { continue; }

      const userId = prefRow.user_id;

      // Get user's companies
      const companies = await env.DB.prepare(
        `SELECT entity_id FROM master WHERE user_id = ? AND entity_type = 'COMPANY' AND is_deleted = 0`
      ).bind(userId).all();

      const companyIds = (companies.results || []).map((r: any) => r.entity_id);
      if (companyIds.length === 0) continue;

      // Aggregate yesterday's stats across all companies
      let docsCreated = 0;
      let totalSales = 0;
      let paidCount = 0;

      for (const cid of companyIds) {
        const stats = await env.DB.prepare(`
          SELECT
            COUNT(*) as doc_count,
            COALESCE(SUM(grand_total), 0) as total_amount,
            COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END), 0) as paid_count
          FROM documents
          WHERE company_id = ? AND is_deleted = 0 AND date(created_at) = ?
        `).bind(cid, yesterday).first() as any;

        if (stats) {
          docsCreated += stats.doc_count || 0;
          totalSales += stats.total_amount || 0;
          paidCount += stats.paid_count || 0;
        }
      }

      if (docsCreated === 0) continue; // Skip if no activity

      const formattedSales = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(totalSales);

      await notifyUser(env, userId, 'dailySummary', {
        title: `สรุปวันที่ ${yesterday}`,
        body: `เอกสาร ${docsCreated} รายการ | ยอด ฿${formattedSales} | ชำระแล้ว ${paidCount}`,
        url: '/',
      });
    }
  } catch (e) {
    console.error('[scheduled] sendDailySummaries error:', e);
  }
}
