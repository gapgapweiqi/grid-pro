import { Hono } from 'hono';
import type { Env } from '../index';
import { adminGuard } from '../middleware/auth';

export const pushRoutes = new Hono<{ Bindings: Env }>();

// ===== Helper: Generate unique ID =====
function generateId(): string {
  return crypto.randomUUID();
}

// ===== Base64 URL helpers =====
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = '='.repeat((4 - str.length % 4) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// ===== VAPID JWT (ES256) =====
// pubKeyRaw = 65-byte uncompressed P-256 public key, privKeyRaw = 32-byte raw private scalar
async function vapidJwt(aud: string, sub: string, privKeyRaw: Uint8Array, pubKeyRaw: Uint8Array): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp: now + 12 * 3600, sub })));
  const unsigned = `${header}.${payload}`;

  // Build JWK from raw key bytes: x = pubKey[1..33], y = pubKey[33..65], d = privKey[0..32]
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256',
    x: b64url(pubKeyRaw.slice(1, 33)),
    y: b64url(pubKeyRaw.slice(33, 65)),
    d: b64url(privKeyRaw),
  };

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64url(sig)}`;
}

// ===== Web Push Encryption (aes128gcm per RFC 8291) =====
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; localPublicKey: Uint8Array; salt: Uint8Array }> {
  const userPublicKey = b64urlDecode(p256dhKey);
  const userAuth = b64urlDecode(authSecret);
  const plaintext = new TextEncoder().encode(payload);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));

  // Import user's public key
  const userKey = await crypto.subtle.importKey('raw', userPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: userKey }, localKeyPair.privateKey, 256));

  // Generate salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive IKM: HKDF(salt=authSecret, ikm=sharedSecret, info="WebPush: info\0" || receiverPub || senderPub, 32)
  const infoPrefix = new TextEncoder().encode('WebPush: info\0');
  const keyInfo = concat(infoPrefix, userPublicKey, localPublicKeyRaw);

  const sharedHkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: userAuth, info: keyInfo }, sharedHkdfKey, 256
  ));

  // Derive CEK and nonce from IKM using salt
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: cekInfo }, ikmKey, 128
  ));

  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: nonceInfo }, ikmKey, 96
  ));

  // Pad plaintext: add delimiter byte 0x02 (final record)
  const padded = concat(plaintext, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096); // max record size
  const idlen = new Uint8Array([65]); // uncompressed P-256 public key = 65 bytes

  const encrypted = concat(salt, rs, idlen, localPublicKeyRaw, ciphertext);

  return { encrypted, localPublicKey: localPublicKeyRaw, salt };
}

// ===== Send single push notification =====
async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ ok: boolean; status: number }> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const privKeyBytes = b64urlDecode(vapidPrivateKey);
    const pubKeyBytes = b64urlDecode(vapidPublicKey);
    const jwt = await vapidJwt(audience, 'mailto:noreply@grid-doc.com', privKeyBytes, pubKeyBytes);

    // Encrypt payload using Web Push encryption
    const { encrypted } = await encryptPayload(payload, sub.p256dh, sub.auth);

    const response = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': String(encrypted.length),
        TTL: '86400',
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: encrypted,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[push] Push service responded ${response.status}: ${errText}`);
      return { ok: false, status: response.status, error: errText.slice(0, 200) };
    }
    return { ok: true, status: response.status };
  } catch (e: any) {
    console.error('[push] Send error:', e);
    return { ok: false, status: 0, error: e?.message || String(e) };
  }
}

// ===== POST /subscribe — Save push subscription for current user =====
pushRoutes.post('/subscribe', async (c) => {
  const userId = (c as any).get('userId');
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const body = await c.req.json<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    tags?: string[];
  }>();

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ ok: false, error: 'Missing subscription data' }, 400);
  }

  const db = c.env.DB;
  const id = generateId();
  const tags = JSON.stringify(body.tags || []);

  // Upsert by endpoint (one device = one subscription)
  await db.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, tags, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      tags = excluded.tags,
      updated_at = datetime('now')
  `).bind(id, userId, body.endpoint, body.keys.p256dh, body.keys.auth, tags).run();

  return c.json({ ok: true });
});

// ===== POST /unsubscribe — Remove push subscription =====
pushRoutes.post('/unsubscribe', async (c) => {
  const userId = (c as any).get('userId');
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const body = await c.req.json<{ endpoint: string }>();
  if (!body.endpoint) return c.json({ ok: false, error: 'Missing endpoint' }, 400);

  const db = c.env.DB;
  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
    .bind(body.endpoint, userId).run();

  return c.json({ ok: true });
});

// ===== POST /send — Admin: Send push notification =====
pushRoutes.post('/send', adminGuard, async (c) => {
  const senderId = (c as any).get('userId');
  const db = c.env.DB;

  const body = await c.req.json<{
    targetType: 'broadcast' | 'user' | 'tag';
    targetValue?: string;
    title: string;
    body?: string;
    imageUrl?: string;
    url?: string;
  }>();

  if (!body.title) return c.json({ ok: false, error: 'Missing title' }, 400);

  // Get target subscriptions
  let subs: any[];
  if (body.targetType === 'broadcast') {
    const res = await db.prepare('SELECT * FROM push_subscriptions').all();
    subs = res.results || [];
  } else if (body.targetType === 'user' && body.targetValue) {
    const res = await db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
      .bind(body.targetValue).all();
    subs = res.results || [];
  } else if (body.targetType === 'tag' && body.targetValue) {
    // Filter by tag — tags are stored as JSON array
    const res = await db.prepare('SELECT * FROM push_subscriptions').all();
    subs = (res.results || []).filter((s: any) => {
      try {
        const tags = JSON.parse(s.tags || '[]');
        return tags.includes(body.targetValue);
      } catch { return false; }
    });
  } else {
    return c.json({ ok: false, error: 'Invalid target' }, 400);
  }

  // Build notification payload
  const notificationPayload = JSON.stringify({
    title: body.title,
    body: body.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    image: body.imageUrl || undefined,
    data: { url: body.url || '/' },
  });

  // Send to all subscriptions (fire and forget for speed)
  let sentCount = 0;
  const failedEndpoints: string[] = [];

  await Promise.allSettled(subs.map(async (sub: any) => {
    const result = await sendPushToSubscription(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      notificationPayload,
      c.env.VAPID_PUBLIC_KEY,
      c.env.VAPID_PRIVATE_KEY
    );
    if (result.ok) {
      sentCount++;
    } else if (result.status === 404 || result.status === 410) {
      // Subscription expired — clean up
      failedEndpoints.push(sub.endpoint);
    }
  }));

  // Clean up expired subscriptions
  if (failedEndpoints.length > 0) {
    for (const endpoint of failedEndpoints) {
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
    }
  }

  // Log notification
  const logId = generateId();
  await db.prepare(`
    INSERT INTO notification_log (id, sender_id, target_type, target_value, title, body, image_url, sent_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(logId, senderId, body.targetType, body.targetValue || '', body.title, body.body || '', body.imageUrl || '', sentCount).run();

  return c.json({ ok: true, data: { sentCount, totalSubscriptions: subs.length, cleaned: failedEndpoints.length } });
});

// ===== POST /test — Send test push to current user (for debugging) =====
pushRoutes.post('/test', async (c) => {
  const userId = (c as any).get('userId');
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const db = c.env.DB;
  const subs = await db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').bind(userId).all();

  if (!subs.results?.length) {
    return c.json({ ok: false, error: 'No subscription found for your user. Please subscribe first in Settings > Notifications.', userId, subCount: 0 });
  }

  const vapidPub = c.env.VAPID_PUBLIC_KEY;
  const vapidPriv = c.env.VAPID_PRIVATE_KEY;

  if (!vapidPub || !vapidPriv) {
    return c.json({ ok: false, error: 'VAPID keys not configured', hasPublic: !!vapidPub, hasPrivate: !!vapidPriv });
  }

  const payload = JSON.stringify({
    title: 'ทดสอบแจ้งเตือน',
    body: `ส่งถึง ${userId.slice(0, 8)}... เวลา ${new Date().toISOString()}`,
    data: { url: '/settings?tab=notifications' },
  });

  const results: any[] = [];
  for (const sub of subs.results as any[]) {
    try {
      const result = await sendPushToSubscription(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload, vapidPub, vapidPriv
      );
      results.push({ endpoint: sub.endpoint.slice(0, 60) + '...', ...result });
    } catch (e: any) {
      results.push({ endpoint: sub.endpoint.slice(0, 60) + '...', ok: false, error: e?.message || String(e) });
    }
  }

  return c.json({ ok: true, data: { userId, subCount: subs.results.length, results } });
});

// ===== GET /log — Admin: Get notification history =====
pushRoutes.get('/log', adminGuard, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare(`
    SELECT nl.*, u.name as sender_name, u.email as sender_email
    FROM notification_log nl
    LEFT JOIN users u ON nl.sender_id = u.user_id
    ORDER BY nl.created_at DESC
    LIMIT 50
  `).all();

  return c.json({ ok: true, data: res.results || [] });
});

// ===== GET /subscribers — Admin: Get subscriber count and list =====
pushRoutes.get('/subscribers', adminGuard, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare(`
    SELECT ps.user_id, ps.tags, ps.created_at, ps.endpoint, u.name, u.email, u.avatar_url
    FROM push_subscriptions ps
    LEFT JOIN users u ON ps.user_id = u.user_id
    ORDER BY ps.created_at DESC
  `).all();

  return c.json({ ok: true, data: res.results || [] });
});

// ===== DELETE /log/:id — Admin: Delete a single notification log entry =====
pushRoutes.delete('/log/:id', adminGuard, async (c) => {
  const db = c.env.DB;
  const logId = c.req.param('id');
  await db.prepare('DELETE FROM notification_log WHERE id = ?').bind(logId).run();
  return c.json({ ok: true });
});

// ===== DELETE /log-all — Admin: Clear all notification history =====
pushRoutes.delete('/log-all', adminGuard, async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM notification_log').run();
  return c.json({ ok: true });
});

// ===== PUT /preferences — Save user push notification preferences =====
pushRoutes.put('/preferences', async (c) => {
  const userId = (c as any).get('userId');
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const prefs = await c.req.json();
  const db = c.env.DB;
  const json = JSON.stringify(prefs);

  await db.prepare(`
    INSERT INTO push_preferences (user_id, preferences, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      preferences = excluded.preferences,
      updated_at = datetime('now')
  `).bind(userId, json).run();

  return c.json({ ok: true });
});

// ===== GET /preferences — Get user push notification preferences =====
pushRoutes.get('/preferences', async (c) => {
  const userId = (c as any).get('userId');
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const db = c.env.DB;
  const row = await db.prepare('SELECT preferences FROM push_preferences WHERE user_id = ?').bind(userId).first();

  if (row?.preferences) {
    try {
      return c.json({ ok: true, data: JSON.parse(row.preferences as string) });
    } catch {}
  }
  // Return defaults
  return c.json({ ok: true, data: { announcements: true, docUpdates: true, payments: true, teamUpdates: true, overdueReminders: true, dailySummary: false } });
});

// ===== PUT /subscribers/tags — Admin: Update tags for a subscriber =====
pushRoutes.put('/subscribers/tags', adminGuard, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ endpoint: string; tags: string[] }>();
  if (!body.endpoint) return c.json({ ok: false, error: 'Missing endpoint' }, 400);
  const tags = JSON.stringify(body.tags || []);
  await db.prepare('UPDATE push_subscriptions SET tags = ?, updated_at = datetime(\'now\') WHERE endpoint = ?')
    .bind(tags, body.endpoint).run();
  return c.json({ ok: true });
});
