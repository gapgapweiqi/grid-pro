/**
 * Shared push notification helpers for event-driven triggers.
 * Used by docs.ts, team.ts, etc. to send push notifications on mutations.
 */

import type { Env } from '../index';

/**
 * Send push notification to a specific user (all their subscriptions).
 * Checks user's push_preferences before sending.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notifyUser(
  env: Env,
  targetUserId: string,
  category: string,
  notification: { title: string; body: string; url?: string }
): Promise<void> {
  try {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

    // Check user preferences
    const prefRow = await env.DB.prepare('SELECT preferences FROM push_preferences WHERE user_id = ?').bind(targetUserId).first();
    if (prefRow?.preferences) {
      try {
        const prefs = JSON.parse(prefRow.preferences as string);
        if (prefs[category] === false) return; // User opted out of this category
      } catch {}
    }

    // Get user's push subscriptions
    const subs = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').bind(targetUserId).all();
    if (!subs.results?.length) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: notification.url || '/' },
    });

    // Dynamic import to avoid circular deps — push.ts has the crypto helpers
    // Instead, we inline a minimal fetch-based send (no encryption needed for same approach)
    // Actually we need the full encryption. Let's call the send endpoint internally.
    // Simpler approach: directly call sendPushToAllSubs
    const failedEndpoints: string[] = [];

    await Promise.allSettled((subs.results as any[]).map(async (sub: any) => {
      try {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY
        );
        if (!result.ok && (result.status === 404 || result.status === 410)) {
          failedEndpoints.push(sub.endpoint);
        }
      } catch {}
    }));

    // Clean up expired subscriptions
    for (const ep of failedEndpoints) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(ep).run().catch(() => {});
    }
  } catch (e) {
    console.error('[push-helper] notifyUser error:', e);
  }
}

/**
 * Notify the owner of a company (find owner user_id from companies table).
 */
export async function notifyCompanyOwner(
  env: Env,
  companyId: string,
  category: string,
  notification: { title: string; body: string; url?: string }
): Promise<void> {
  try {
    const company = await env.DB.prepare(
      `SELECT user_id FROM master WHERE entity_id = ? AND entity_type = 'COMPANY'`
    ).bind(companyId).first();
    if (company?.user_id) {
      await notifyUser(env, company.user_id as string, category, notification);
    }
  } catch (e) {
    console.error('[push-helper] notifyCompanyOwner error:', e);
  }
}

// ===== Minimal Web Push implementation (duplicated from push.ts to avoid circular imports) =====

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

async function vapidJwt(aud: string, sub: string, privKeyRaw: Uint8Array, pubKeyRaw: Uint8Array): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp: now + 12 * 3600, sub })));
  const unsigned = `${header}.${payload}`;
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256',
    x: b64url(pubKeyRaw.slice(1, 33)),
    y: b64url(pubKeyRaw.slice(33, 65)),
    d: b64url(privKeyRaw),
  };
  const key = await (crypto.subtle as any).importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64url(sig)}`;
}

async function encryptPayload(payload: string, p256dhKey: string, authSecret: string) {
  const userPublicKey = b64urlDecode(p256dhKey);
  const userAuth = b64urlDecode(authSecret);
  const plaintext = new TextEncoder().encode(payload);
  const localKeyPair = await (crypto.subtle as any).generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublicKeyRaw = new Uint8Array(await (crypto.subtle as any).exportKey('raw', localKeyPair.publicKey));
  const userKey = await (crypto.subtle as any).importKey('raw', userPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await (crypto.subtle as any).deriveBits({ name: 'ECDH', public: userKey }, localKeyPair.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const infoPrefix = new TextEncoder().encode('WebPush: info\0');
  const keyInfo = concat(infoPrefix, userPublicKey, localPublicKeyRaw);
  const sharedHkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: userAuth, info: keyInfo }, sharedHkdfKey, 256));
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cek = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, ikmKey, 128));
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, ikmKey, 96));
  const padded = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const idlen = new Uint8Array([65]);
  const encrypted = concat(salt, rs, idlen, localPublicKeyRaw, ciphertext);
  return { encrypted, localPublicKey: localPublicKeyRaw, salt };
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ ok: boolean; status: number }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const privKeyBytes = b64urlDecode(vapidPrivateKey);
  const pubKeyBytes = b64urlDecode(vapidPublicKey);
  const jwt = await vapidJwt(audience, 'mailto:noreply@grid-doc.com', privKeyBytes, pubKeyBytes);
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
  return { ok: response.ok, status: response.status };
}
