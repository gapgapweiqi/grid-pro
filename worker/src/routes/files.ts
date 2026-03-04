import { Hono } from 'hono';
import type { Env } from '../index';

export const fileRoutes = new Hono<{ Bindings: Env }>();

/** POST /upload — Upload file to Google Drive */
fileRoutes.post('/upload', async (c) => {
  const userId = c.get('userId' as never) as string;
  const db = c.env.DB;

  // Get user's Google tokens
  const user = await db.prepare('SELECT google_access_token, drive_folder_id FROM users WHERE user_id = ?').bind(userId).first() as any;
  if (!user?.google_access_token) {
    return c.json({ ok: false, error: { code: 'NO_GOOGLE', message: 'Google Drive not connected' } }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const refType = formData.get('refType') as string || '';
  const refId = formData.get('refId') as string || '';
  const companyId = formData.get('companyId') as string || '';

  if (!file) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'No file provided' } }, 400);

  // Upload to Google Drive
  const metadata = JSON.stringify({
    name: file.name,
    parents: user.drive_folder_id ? [user.drive_folder_id] : [],
  });

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const fileArrayBuffer = await file.arrayBuffer();
  const multipartBody = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadata,
    delimiter,
    `Content-Type: ${file.type}\r\n\r\n`,
    fileArrayBuffer,
    closeDelim,
  ]);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${user.google_access_token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    return c.json({ ok: false, error: { code: 'DRIVE_ERROR', message: `Upload failed: ${err}` } }, 500);
  }

  const driveFile = await uploadRes.json() as any;

  // Save file metadata to D1
  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO files (file_id, user_id, company_id, ref_type, ref_id, mime_type, name, size, drive_file_id, drive_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    fileId, userId, companyId, refType, refId,
    file.type, file.name, file.size,
    driveFile.id, driveFile.webViewLink || '', now, now
  ).run();

  return c.json({
    ok: true,
    data: {
      fileId,
      driveFileId: driveFile.id,
      driveUrl: driveFile.webViewLink || '',
      name: file.name,
    },
  });
});

/** GET /proxy/:driveFileId — Proxy Google Drive file content with caching */
fileRoutes.get('/proxy/:driveFileId', async (c) => {
  const userId = c.get('userId' as never) as string;
  const driveFileId = c.req.param('driveFileId');
  if (!driveFileId) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing driveFileId' } }, 400);

  const db = c.env.DB;
  const user = await db.prepare('SELECT google_access_token, google_refresh_token FROM users WHERE user_id = ?').bind(userId).first() as any;
  if (!user?.google_access_token) {
    return c.json({ ok: false, error: { code: 'NO_GOOGLE', message: 'Google Drive not connected' } }, 400);
  }

  let accessToken = user.google_access_token;

  // Try to fetch the file
  let driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  // If 401, try refreshing token
  if (driveRes.status === 401 && user.google_refresh_token) {
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: c.env.GOOGLE_CLIENT_ID,
          client_secret: c.env.GOOGLE_CLIENT_SECRET,
          refresh_token: user.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json() as any;
        accessToken = refreshData.access_token;
        await db.prepare('UPDATE users SET google_access_token = ?, updated_at = ? WHERE user_id = ?')
          .bind(accessToken, new Date().toISOString(), userId).run();
        driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
      }
    } catch { /* use original response */ }
  }

  if (!driveRes.ok) {
    return c.json({ ok: false, error: { code: 'DRIVE_ERROR', message: `Drive fetch failed (${driveRes.status})` } }, driveRes.status as any);
  }

  const contentType = driveRes.headers.get('Content-Type') || 'application/octet-stream';
  const body = await driveRes.arrayBuffer();

  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

/** GET /?companyId=xxx&refType=DOC&refId=xxx */
fileRoutes.get('/', async (c) => {
  const companyId = c.req.query('companyId');
  const refType = c.req.query('refType');
  const refId = c.req.query('refId');

  let sql = `SELECT * FROM files WHERE is_deleted = 0`;
  const params: any[] = [];
  if (companyId) { sql += ` AND company_id = ?`; params.push(companyId); }
  if (refType) { sql += ` AND ref_type = ?`; params.push(refType); }
  if (refId) { sql += ` AND ref_id = ?`; params.push(refId); }
  sql += ` ORDER BY created_at DESC`;

  const rows = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({
    ok: true,
    data: rows.results.map((r: any) => ({
      fileId: r.file_id,
      name: r.name,
      mimeType: r.mime_type,
      size: r.size,
      driveFileId: r.drive_file_id,
      driveUrl: r.drive_url,
      createdAt: r.created_at,
    })),
  });
});
