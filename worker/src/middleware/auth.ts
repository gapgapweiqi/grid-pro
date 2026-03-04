import { Context, Next } from 'hono';
import type { Env } from '../index';

/** Simple JWT auth middleware — validates Bearer token */
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  // Skip auth for OPTIONS (CORS preflight) and public routes
  if (c.req.method === 'OPTIONS') return next();
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/auth/') || path === '/api/health') return next();

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing auth token' } }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    c.set('userId' as never, payload.sub as never);
    c.set('userEmail' as never, payload.email as never);
  } catch {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401);
  }

  return next();
}

/** Admin guard middleware — must be used after authMiddleware */
export async function adminGuard(c: Context<{ Bindings: Env }>, next: Next) {
  const userId = c.get('userId' as never) as string;
  if (!userId) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401);
  }
  const user = await c.env.DB.prepare('SELECT is_admin FROM users WHERE user_id = ?').bind(userId).first() as any;
  if (!user || !user.is_admin) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
  }
  return next();
}

/** Create a simple JWT (HS256 via Web Crypto) */
export async function createJwt(payload: Record<string, unknown>, secret: string, expiresInSec = 7 * 24 * 3600): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSec };

  const enc = new TextEncoder();
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(fullPayload));
  const data = enc.encode(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const sigB64 = base64url(sig);

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

/** Verify JWT and return payload */
export async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const enc = new TextEncoder();
  const data = enc.encode(`${parts[0]}.${parts[1]}`);
  const sig = base64urlDecode(parts[2]);

  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, sig, data);
  if (!valid) throw new Error('Invalid signature');

  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

function base64url(input: string | ArrayBuffer): string {
  const str = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
