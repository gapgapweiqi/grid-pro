import { Hono } from 'hono';
import type { Env } from '../index';

export const imageRoutes = new Hono<{ Bindings: Env }>();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

/** POST /upload — Upload image to R2 */
imageRoutes.post('/upload', async (c) => {
  const userId = c.get('userId' as never) as string;
  const formData = await c.req.formData();
  const file = formData.get('file') as unknown as File | null;
  const companyId = (formData.get('companyId') as string) || '';
  const refType = (formData.get('refType') as string) || 'general'; // logo, qr, stamp, general

  if (!file) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'No file provided' } }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid file type. Allowed: PNG, JPEG, WebP, GIF, SVG' } }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'File too large. Max 5MB' } }, 400);
  }

  // Generate unique key: {companyId}/{refType}/{uuid}.{ext}
  const ext = file.name.split('.').pop() || 'png';
  const uuid = crypto.randomUUID();
  const key = companyId
    ? `${companyId}/${refType}/${uuid}.${ext}`
    : `${userId}/${refType}/${uuid}.${ext}`;

  // Upload to R2
  try {
    await c.env.IMAGES.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        userId,
        companyId,
        refType,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return c.json({ ok: false, error: { code: 'R2_ERROR', message: `Upload failed: ${err.message}` } }, 500);
  }

  // Return the R2 key (frontend will construct URL as /api/images/{key})
  return c.json({
    ok: true,
    data: {
      key,
      url: `/api/images/${key}`,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    },
  });
});

/** GET /:key+ — Serve image from R2 with aggressive caching */
imageRoutes.get('/*', async (c) => {
  // Extract key from the path after /api/images/
  const key = c.req.path.replace(/^\//, '');

  if (!key) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing image key' } }, 400);
  }

  const object = await c.env.IMAGES.get(key);
  if (!object) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Image not found' } }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
});

/** DELETE /:key+ — Delete image from R2 */
imageRoutes.delete('/*', async (c) => {
  const key = c.req.path.replace(/^\//, '');

  if (!key) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing image key' } }, 400);
  }

  try {
    await c.env.IMAGES.delete(key);
  } catch (err: any) {
    return c.json({ ok: false, error: { code: 'R2_ERROR', message: `Delete failed: ${err.message}` } }, 500);
  }

  return c.json({ ok: true, data: { deleted: key } });
});
