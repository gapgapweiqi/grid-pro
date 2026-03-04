import { Hono } from 'hono';
import type { Env } from '../index';
import { createJwt } from '../middleware/auth';

export const authRoutes = new Hono<{ Bindings: Env }>();

/** Google OAuth: exchange code for tokens, create/login user */
authRoutes.post('/google', async (c) => {
  const { code, redirectUri } = await c.req.json();
  if (!code) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing code' } }, 400);

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri || `${c.env.CORS_ORIGIN}/login`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return c.json({ ok: false, error: { code: 'GOOGLE_ERROR', message: `Token exchange failed: ${err}` } }, 400);
  }

  const tokens = await tokenRes.json() as any;
  const { access_token, refresh_token, expires_in, id_token } = tokens;

  // Decode ID token to get user info
  const payload = JSON.parse(atob(id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  const { sub: googleId, email, name, picture } = payload;

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Download Google profile picture and upload to R2 for reliable serving
  let avatarR2Url = '';
  if (picture) {
    try {
      const picRes = await fetch(picture);
      if (picRes.ok) {
        const contentType = picRes.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        const avatarKey = `avatars/${googleId}.${ext}`;
        await c.env.IMAGES.put(avatarKey, await picRes.arrayBuffer(), {
          httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
          customMetadata: { source: 'google', googleId, uploadedAt: now },
        });
        avatarR2Url = `/api/images/${avatarKey}`;
      }
    } catch {
      // If download fails, fall back to empty avatar (user can upload manually)
    }
  }

  // Check if user exists
  let user = await db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').bind(googleId, email).first();

  if (!user) {
    // Create new user
    const userId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO users (user_id, email, name, avatar_url, auth_provider, google_id, google_access_token, google_refresh_token, google_token_expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'google', ?, ?, ?, ?, ?, ?)
    `).bind(
      userId, email, name || '', avatarR2Url || '', googleId,
      access_token, refresh_token || '', new Date(Date.now() + expires_in * 1000).toISOString(),
      now, now
    ).run();

    // Create default company for new user
    const companyId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO master (entity_id, entity_type, user_id, company_id, name, status, json, created_at, updated_at)
      VALUES (?, 'COMPANY', ?, ?, ?, 'ACTIVE', '{}', ?, ?)
    `).bind(companyId, userId, companyId, `บริษัทของ ${name || email}`, now, now).run();

    // Drive folder creation skipped — will be created on-demand via POST /me/drive
    // when user grants drive.file scope later

    user = { user_id: userId, email, name: name || '', avatar_url: avatarR2Url || '', auth_provider: 'google', google_id: googleId };
  } else {
    // Update tokens and avatar (re-download to R2 on each login to keep it fresh)
    await db.prepare(`
      UPDATE users SET google_access_token = ?, google_refresh_token = COALESCE(NULLIF(?, ''), google_refresh_token),
      google_token_expires_at = ?, avatar_url = COALESCE(NULLIF(?, ''), avatar_url), updated_at = ?
      WHERE user_id = ?
    `).bind(
      access_token, refresh_token || '', new Date(Date.now() + expires_in * 1000).toISOString(),
      avatarR2Url || '', now, (user as any).user_id
    ).run();

    // Drive folder creation skipped — will be created on-demand via POST /me/drive
  }

  // Re-read user from DB to get latest data (including drive_folder_id)
  const freshUser = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind((user as any).user_id).first() as any;
  const u = freshUser || user;

  // Create JWT
  const jwt = await createJwt({ sub: u.user_id, email: u.email }, c.env.JWT_SECRET);

  return c.json({
    ok: true,
    data: {
      token: jwt,
      user: {
        userId: u.user_id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatar_url,
        authProvider: u.auth_provider,
        driveFolderId: u.drive_folder_id || '',
      },
    },
  });
});

/** Email/password register */
authRoutes.post('/register', async (c) => {
  const { email, password, name } = await c.req.json();
  if (!email || !password) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing email or password' } }, 400);

  const db = c.env.DB;
  const existing = await db.prepare('SELECT user_id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.json({ ok: false, error: { code: 'CONFLICT', message: 'Email already registered' } }, 409);

  // Hash password using Web Crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO users (user_id, email, password_hash, name, auth_provider, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'email', ?, ?)
  `).bind(userId, email, passwordHash, name || '', now, now).run();

  // Create default company
  const companyId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO master (entity_id, entity_type, user_id, company_id, name, status, json, created_at, updated_at)
    VALUES (?, 'COMPANY', ?, ?, ?, 'ACTIVE', '{}', ?, ?)
  `).bind(companyId, userId, companyId, `บริษัทของ ${name || email}`, now, now).run();

  const jwt = await createJwt({ sub: userId, email }, c.env.JWT_SECRET);

  return c.json({
    ok: true,
    data: {
      token: jwt,
      user: { userId, email, name: name || '', avatarUrl: '', authProvider: 'email', driveFolderId: '' },
    },
  });
});

/** Email/password login */
authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing email or password' } }, 400);

  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND auth_provider = ?').bind(email, 'email').first() as any;
  if (!user) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // Verify password
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (passwordHash !== user.password_hash) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid password' } }, 401);
  }

  const jwt = await createJwt({ sub: user.user_id, email: user.email }, c.env.JWT_SECRET);

  return c.json({
    ok: true,
    data: {
      token: jwt,
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        authProvider: user.auth_provider,
        driveFolderId: user.drive_folder_id || '',
      },
    },
  });
});

/** PATCH /me — Update user profile (name, avatar) */
authRoutes.patch('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }, 401);
  }
  const { verifyJwt } = await import('../middleware/auth');
  try {
    const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
    const body = await c.req.json();
    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: any[] = [];
    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(body.avatarUrl); }
    if (updates.length === 0) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Nothing to update' } }, 400);
    updates.push('updated_at = ?'); params.push(now); params.push(payload.sub);
    await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`).bind(...params).run();
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE user_id = ?').bind(payload.sub).first() as any;
    return c.json({ ok: true, data: { userId: user.user_id, email: user.email, name: user.name, avatarUrl: user.avatar_url, authProvider: user.auth_provider, driveFolderId: user.drive_folder_id || '' } });
  } catch {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
  }
});

/** PUT /password — Change password (email auth only) */
authRoutes.put('/password', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }, 401);
  }
  const { verifyJwt } = await import('../middleware/auth');
  try {
    const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing passwords' } }, 400);

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE user_id = ? AND auth_provider = ?').bind(payload.sub, 'email').first() as any;
    if (!user) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Only email auth users can change password' } }, 400);

    const encoder = new TextEncoder();
    const currentHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(currentPassword)))).map(b => b.toString(16).padStart(2, '0')).join('');
    if (currentHash !== user.password_hash) {
      return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' } }, 401);
    }

    const newHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(newPassword)))).map(b => b.toString(16).padStart(2, '0')).join('');
    await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?').bind(newHash, new Date().toISOString(), payload.sub).run();
    return c.json({ ok: true, data: { message: 'Password changed' } });
  } catch {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
  }
});

/** DELETE /me — Delete account */
authRoutes.delete('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }, 401);
  }
  const { verifyJwt } = await import('../middleware/auth');
  try {
    const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
    await c.env.DB.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE user_id = ?').bind(new Date().toISOString(), payload.sub).run();
    return c.json({ ok: true, data: { message: 'Account deactivated' } });
  } catch {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
  }
});

/** POST /google/connect — Connect Google account + Drive for email/line users */
authRoutes.post('/google/connect', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }, 401);
  }
  const { verifyJwt } = await import('../middleware/auth');
  try {
    const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
    const { code, redirectUri } = await c.req.json();
    if (!code) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing code' } }, 400);

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return c.json({ ok: false, error: { code: 'GOOGLE_ERROR', message: `Token exchange failed: ${err}` } }, 400);
    }
    const tokens = await tokenRes.json() as any;
    const { access_token, refresh_token, expires_in, id_token } = tokens;

    // Decode ID token to get Google user info
    const idPayload = JSON.parse(atob(id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const googleId = idPayload.sub;

    const db = c.env.DB;
    const now = new Date().toISOString();

    // Update user with Google tokens
    await db.prepare(`
      UPDATE users SET google_id = ?, google_access_token = ?, google_refresh_token = COALESCE(NULLIF(?, ''), google_refresh_token),
      google_token_expires_at = ?, updated_at = ? WHERE user_id = ?
    `).bind(
      googleId, access_token, refresh_token || '',
      new Date(Date.now() + (expires_in || 3600) * 1000).toISOString(), now, payload.sub
    ).run();

    // Create Drive folder
    let driveFolderId = '';
    try {
      const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Grid Doc Files', mimeType: 'application/vnd.google-apps.folder' }),
      });
      if (folderRes.ok) {
        const folder = await folderRes.json() as any;
        driveFolderId = folder.id;
        await db.prepare('UPDATE users SET drive_folder_id = ? WHERE user_id = ?').bind(driveFolderId, payload.sub).run();
      }
    } catch (err) {
      console.error('[google/connect] Drive folder error:', err);
    }

    return c.json({ ok: true, data: { googleId, driveFolderId } });
  } catch (err: any) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: err?.message || 'Invalid token' } }, 401);
  }
});

/** POST /forgot-password — Send password reset email via Resend */
authRoutes.post('/forgot-password', async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing email' } }, 400);

  const db = c.env.DB;
  const user = await db.prepare('SELECT user_id, auth_provider FROM users WHERE email = ?').bind(email).first() as any;

  // Always return success to avoid email enumeration
  if (!user || user.auth_provider !== 'email') {
    return c.json({ ok: true, data: { message: 'If this email exists, a reset link has been sent.' } });
  }

  // Generate reset token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour
  const now = new Date().toISOString();

  // Store token (create table if not exists via simple approach — use existing D1)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    INSERT INTO password_reset_tokens (token, user_id, expires_at, used, created_at)
    VALUES (?, ?, ?, 0, ?)
  `).bind(token, user.user_id, expiresAt, now).run();

  // Send email via Resend
  const resetUrl = `https://grid-doc.com/reset-password?token=${token}`;
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Grid Doc <onboarding@resend.dev>',
        to: [email],
        subject: 'รีเซ็ตรหัสผ่าน Grid Doc',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1f3a5f;">รีเซ็ตรหัสผ่าน</h2>
            <p>คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี Grid Doc</p>
            <p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง):</p>
            <a href="${resetUrl}" style="display: inline-block; background: #1f3a5f; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">ตั้งรหัสผ่านใหม่</a>
            <p style="color: #6b7280; font-size: 13px;">หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้</p>
          </div>
        `,
      }),
    });
    if (!resendRes.ok) {
      console.error('[forgot-password] Resend error:', await resendRes.text());
    }
  } catch (err) {
    console.error('[forgot-password] Email send error:', err);
  }

  return c.json({ ok: true, data: { message: 'If this email exists, a reset link has been sent.' } });
});

/** POST /reset-password — Verify token and set new password */
authRoutes.post('/reset-password', async (c) => {
  const { token, newPassword } = await c.req.json();
  if (!token || !newPassword) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing token or password' } }, 400);
  if (newPassword.length < 8) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Password must be at least 8 characters' } }, 400);

  const db = c.env.DB;
  const resetToken = await db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').bind(token).first() as any;

  if (!resetToken) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired token' } }, 400);
  if (resetToken.used) return c.json({ ok: false, error: { code: 'USED', message: 'Token already used' } }, 400);
  if (new Date(resetToken.expires_at) < new Date()) return c.json({ ok: false, error: { code: 'EXPIRED', message: 'Token expired' } }, 400);

  // Hash new password
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(newPassword));
  const passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const now = new Date().toISOString();
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?').bind(passwordHash, now, resetToken.user_id).run();
  await db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').bind(token).run();

  return c.json({ ok: true, data: { message: 'Password reset successful' } });
});

/** LINE OAuth: exchange code for tokens, create/login user */
authRoutes.post('/line', async (c) => {
  const { code, redirectUri } = await c.req.json();
  if (!code) return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing code' } }, 400);

  if (!c.env.LINE_CHANNEL_ID || !c.env.LINE_CHANNEL_SECRET) {
    return c.json({ ok: false, error: { code: 'NOT_CONFIGURED', message: 'LINE Login is not configured yet' } }, 501);
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || `${c.env.CORS_ORIGIN}/login`,
      client_id: c.env.LINE_CHANNEL_ID,
      client_secret: c.env.LINE_CHANNEL_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return c.json({ ok: false, error: { code: 'LINE_ERROR', message: `Token exchange failed: ${err}` } }, 400);
  }

  const tokens = await tokenRes.json() as any;
  const { access_token, id_token } = tokens;

  // Get LINE profile
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { 'Authorization': `Bearer ${access_token}` },
  });
  if (!profileRes.ok) {
    return c.json({ ok: false, error: { code: 'LINE_ERROR', message: 'Failed to get LINE profile' } }, 400);
  }
  const profile = await profileRes.json() as any;
  const { userId: lineUserId, displayName, pictureUrl } = profile;

  // Try to get email from id_token (if openid + email scope was granted)
  let email = '';
  if (id_token) {
    try {
      const idPayload = JSON.parse(atob(id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      email = idPayload.email || '';
    } catch { /* no email in token */ }
  }

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Download LINE profile picture and upload to R2 for reliable serving
  let avatarR2Url = '';
  if (pictureUrl) {
    try {
      const picRes = await fetch(pictureUrl);
      if (picRes.ok) {
        const contentType = picRes.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        const avatarKey = `avatars/line_${lineUserId}.${ext}`;
        await c.env.IMAGES.put(avatarKey, await picRes.arrayBuffer(), {
          httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
          customMetadata: { source: 'line', lineUserId, uploadedAt: now },
        });
        avatarR2Url = `/api/images/${avatarKey}`;
      }
    } catch {
      // If download fails, fall back to empty avatar
    }
  }

  // Check if user exists by LINE ID or email
  let user: any = await db.prepare('SELECT * FROM users WHERE line_id = ?').bind(lineUserId).first();
  if (!user && email) {
    user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  }

  if (!user) {
    // Create new user
    const userId = crypto.randomUUID();
    const userEmail = email || `line_${lineUserId}@line.local`;
    await db.prepare(`
      INSERT INTO users (user_id, email, name, avatar_url, auth_provider, line_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'line', ?, ?, ?)
    `).bind(userId, userEmail, displayName || '', avatarR2Url || '', lineUserId, now, now).run();

    // Create default company
    const companyId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO master (entity_id, entity_type, user_id, company_id, name, status, json, created_at, updated_at)
      VALUES (?, 'COMPANY', ?, ?, ?, 'ACTIVE', '{}', ?, ?)
    `).bind(companyId, userId, companyId, `บริษัทของ ${displayName || userEmail}`, now, now).run();

    user = { user_id: userId, email: userEmail, name: displayName || '', avatar_url: avatarR2Url || '', auth_provider: 'line', line_id: lineUserId };
  } else {
    // Update LINE info and avatar (re-download to R2 on each login)
    await db.prepare(`
      UPDATE users SET line_id = ?, avatar_url = COALESCE(NULLIF(?, ''), avatar_url), name = COALESCE(NULLIF(?, ''), name), updated_at = ?
      WHERE user_id = ?
    `).bind(lineUserId, avatarR2Url || '', displayName || '', now, user.user_id).run();
  }

  const freshUser = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(user.user_id).first() as any;
  const u = freshUser || user;

  const jwt = await createJwt({ sub: u.user_id, email: u.email }, c.env.JWT_SECRET);

  return c.json({
    ok: true,
    data: {
      token: jwt,
      user: {
        userId: u.user_id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatar_url,
        authProvider: u.auth_provider,
        driveFolderId: u.drive_folder_id || '',
      },
    },
  });
});

/** POST /me/drive — Create Google Drive folder on demand */
authRoutes.post('/me/drive', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }, 401);
  }
  const { verifyJwt } = await import('../middleware/auth');
  try {
    const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
    const db = c.env.DB;
    const user = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(payload.sub).first() as any;
    if (!user) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    // Already has folder
    if (user.drive_folder_id) {
      return c.json({ ok: true, data: { driveFolderId: user.drive_folder_id } });
    }

    // Need access token — non-Google users or users without token should get a clean error
    if (!user.google_access_token && !user.google_refresh_token) {
      return c.json({ ok: false, error: { code: 'NO_TOKEN', message: 'No Google access token. Please connect Google account first.' } }, 400);
    }
    if (!user.google_access_token) {
      return c.json({ ok: false, error: { code: 'NO_TOKEN', message: 'No Google access token. Please re-login with Google.' } }, 400);
    }

    // Try to refresh token first if we have refresh_token
    let accessToken = user.google_access_token;
    if (user.google_refresh_token) {
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
          await db.prepare('UPDATE users SET google_access_token = ?, google_token_expires_at = ?, updated_at = ? WHERE user_id = ?')
            .bind(accessToken, new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(), new Date().toISOString(), payload.sub).run();
        }
      } catch {
        // Use existing token as fallback
      }
    }

    // Create folder
    const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Grid Doc Files',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (folderRes.ok) {
      const folder = await folderRes.json() as any;
      await db.prepare('UPDATE users SET drive_folder_id = ? WHERE user_id = ?').bind(folder.id, payload.sub).run();
      return c.json({ ok: true, data: { driveFolderId: folder.id } });
    } else {
      const errText = await folderRes.text().catch(() => 'Unknown error');
      console.error('[Drive folder create] status:', folderRes.status, errText);
      if (folderRes.status === 401 || folderRes.status === 403) {
        return c.json({ ok: false, error: { code: 'DRIVE_AUTH_ERROR', message: 'Google token expired. Please re-connect Google Drive.' } }, 400);
      }
      return c.json({ ok: false, error: { code: 'DRIVE_ERROR', message: `Google Drive error: ${errText}` } }, 400);
    }
  } catch (err: any) {
    console.error('[Drive folder create] error:', err);
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: err?.message || 'Invalid token' } }, 401);
  }
});

/** Get current user from JWT */
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }, 401);
  }

  const { verifyJwt } = await import('../middleware/auth');
  try {
    const payload = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE user_id = ?').bind(payload.sub).first() as any;
    if (!user) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

    return c.json({
      ok: true,
      data: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        authProvider: user.auth_provider,
        googleId: user.google_id || '',
        driveFolderId: user.drive_folder_id || '',
        isActive: !!user.is_active,
        isAdmin: !!user.is_admin,
        billingStatus: user.billing_status || 'UNPAID',
      },
    });
  } catch {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
  }
});
