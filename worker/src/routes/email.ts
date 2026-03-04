import { Hono } from 'hono';
import type { Env } from '../index';

export const emailRoutes = new Hono<{ Bindings: Env }>();

/** POST /send — Send email via Gmail API */
emailRoutes.post('/send', async (c) => {
  const userId = c.get('userId' as never) as string;
  const db = c.env.DB;
  const body = await c.req.json();

  const { to, cc, subject, htmlBody, pdfBase64, pdfFilename } = body;

  if (!to || !subject) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing to or subject' } }, 400);
  }

  // Get user's Google access token
  const user = await db.prepare('SELECT google_access_token, google_refresh_token, google_token_expires_at, email FROM users WHERE user_id = ?').bind(userId).first() as any;
  if (!user?.google_access_token) {
    return c.json({ ok: false, error: { code: 'NO_GOOGLE', message: 'Gmail not connected' } }, 400);
  }

  // Check if token needs refresh
  let accessToken = user.google_access_token;
  if (user.google_token_expires_at && new Date(user.google_token_expires_at) < new Date()) {
    if (!user.google_refresh_token) {
      return c.json({ ok: false, error: { code: 'TOKEN_EXPIRED', message: 'Google token expired, please re-authenticate' } }, 401);
    }
    // Refresh token
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
      const tokens = await refreshRes.json() as any;
      accessToken = tokens.access_token;
      await db.prepare('UPDATE users SET google_access_token = ?, google_token_expires_at = ? WHERE user_id = ?')
        .bind(accessToken, new Date(Date.now() + tokens.expires_in * 1000).toISOString(), userId).run();
    } else {
      return c.json({ ok: false, error: { code: 'REFRESH_FAILED', message: 'Failed to refresh Google token' } }, 401);
    }
  }

  // Build MIME message
  const boundary = `boundary_${Date.now()}`;
  let mimeLines = [
    `From: ${user.email}`,
    `To: ${to}`,
  ];
  if (cc) mimeLines.push(`Cc: ${cc}`);
  mimeLines.push(
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
  );

  if (pdfBase64 && pdfFilename) {
    mimeLines.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody || '<p>Please see the attached document.</p>',
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      '',
      pdfBase64,
      '',
      `--${boundary}--`,
    );
  } else {
    mimeLines.push(
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody || '<p>No content</p>',
    );
  }

  const rawMessage = mimeLines.join('\r\n');
  const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send via Gmail API
  const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    return c.json({ ok: false, error: { code: 'GMAIL_ERROR', message: `Send failed: ${err}` } }, 500);
  }

  const result = await sendRes.json() as any;
  return c.json({ ok: true, data: { messageId: result.id, threadId: result.threadId } });
});
