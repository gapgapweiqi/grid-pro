import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';

export const billingRoutes = new Hono<{ Bindings: Env }>();

/** GET /status — Get billing status for current user */
billingRoutes.get('/status', async (c) => {
  const userId = c.get('userId' as never) as string;
  const user = await c.env.DB.prepare(
    'SELECT billing_status, is_admin FROM users WHERE user_id = ?'
  ).bind(userId).first() as any;

  if (!user) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // Get entitlements
  const entitlements = await c.env.DB.prepare(
    'SELECT * FROM billing_entitlements WHERE user_id = ? AND is_active = 1'
  ).bind(userId).all();

  // Calculate total seats granted
  const totalSeats = (entitlements.results || []).reduce((sum: number, e: any) => {
    return e.entitlement_type === 'TEAM_SEAT' ? sum + (e.granted_seats || 0) : sum;
  }, 0);

  return c.json({
    ok: true,
    data: {
      billingStatus: user.billing_status || 'UNPAID',
      isAdmin: !!user.is_admin,
      hasOwnerAccess: user.billing_status === 'PAID',
      totalSeats,
      entitlements: (entitlements.results || []).map((e: any) => ({
        entitlementId: e.entitlement_id,
        type: e.entitlement_type,
        grantedSeats: e.granted_seats,
        source: e.source,
        isActive: !!e.is_active,
      })),
    },
  });
});

/** GET /products — List available billing products */
billingRoutes.get('/products', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM billing_products WHERE is_active = 1'
  ).all();

  return c.json({
    ok: true,
    data: (rows.results || []).map((p: any) => ({
      productId: p.product_id,
      name: p.name,
      description: p.description,
      priceThb: p.price_thb,
      productType: p.product_type,
      stripePriceId: p.stripe_price_id,
    })),
  });
});

/** POST /checkout — Create Stripe checkout session */
billingRoutes.post('/checkout', async (c) => {
  const userId = c.get('userId' as never) as string;
  const email = (c.get('userEmail' as never) as string) || '';
  const body = await c.req.json();
  const { productType, quantity } = body;
  const companyId = body.companyId || '';
  const now = new Date().toISOString();

  if (!productType) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing productType' } }, 400);
  }

  // Get product
  const product = await c.env.DB.prepare(
    'SELECT * FROM billing_products WHERE product_type = ? AND is_active = 1'
  ).bind(productType).first() as any;

  if (!product) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
  }

  const qty = productType === 'TEAM_SEAT' ? Math.max(1, quantity || 1) : 1;
  const totalAmount = product.price_thb * qty;

  // Create order record
  const orderId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO billing_orders (order_id, user_id, company_id, order_type, quantity, amount_thb, currency, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'THB', 'PENDING', ?, ?)
  `).bind(orderId, userId, companyId, productType, qty, totalAmount, now, now).run();

  // Create Stripe checkout session
  const STRIPE_SECRET = c.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET) {
    return c.json({ ok: false, error: { code: 'CONFIG_ERROR', message: 'Stripe not configured' } }, 500);
  }

  const origin = c.req.header('origin') || 'https://griddoc-app.pages.dev';

  // Use pre-created Stripe price if available, otherwise fallback to inline price_data
  const stripeBody = new URLSearchParams({
    'mode': 'payment',
    'payment_method_types[0]': 'card',
    'payment_method_types[1]': 'promptpay',
    'line_items[0][quantity]': String(qty),
    'metadata[order_id]': orderId,
    'metadata[user_id]': userId,
    'metadata[company_id]': companyId,
    'metadata[product_type]': productType,
    'metadata[quantity]': String(qty),
    'success_url': `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `${origin}/billing`,
  });
  if (product.stripe_price_id) {
    stripeBody.set('line_items[0][price]', product.stripe_price_id);
  } else {
    stripeBody.set('line_items[0][price_data][currency]', 'thb');
    stripeBody.set('line_items[0][price_data][product_data][name]', product.name);
    stripeBody.set('line_items[0][price_data][unit_amount]', String(product.price_thb * 100));
  }
  if (email) stripeBody.set('customer_email', email);

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stripeBody.toString(),
  });

  const session = await stripeRes.json() as any;

  if (!stripeRes.ok) {
    return c.json({ ok: false, error: { code: 'STRIPE_ERROR', message: session.error?.message || 'Stripe error' } }, 500);
  }

  // Update order with session ID
  await c.env.DB.prepare(
    'UPDATE billing_orders SET stripe_session_id = ?, updated_at = ? WHERE order_id = ?'
  ).bind(session.id, now, orderId).run();

  return c.json({
    ok: true,
    data: {
      orderId,
      checkoutUrl: session.url,
      sessionId: session.id,
    },
  });
});

/** Helper: validate a coupon code and return discount info */
async function validateCoupon(db: any, code: string, userId: string, productType: string, originalAmount: number) {
  if (!code) return { valid: false, error: 'กรุณากรอกรหัสส่วนลด' };
  const coupon = await db.prepare(
    'SELECT * FROM billing_coupons WHERE code = ? COLLATE NOCASE AND is_active = 1'
  ).bind(code.trim()).first() as any;
  if (!coupon) return { valid: false, error: 'รหัสส่วนลดไม่ถูกต้อง' };

  const now = new Date().toISOString();
  if (coupon.starts_at && now < coupon.starts_at) return { valid: false, error: 'รหัสส่วนลดยังไม่เริ่มใช้งาน' };
  if (coupon.expires_at && now > coupon.expires_at) return { valid: false, error: 'รหัสส่วนลดหมดอายุแล้ว' };
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return { valid: false, error: 'รหัสส่วนลดถูกใช้ครบแล้ว' };
  if (coupon.min_amount && originalAmount < coupon.min_amount) return { valid: false, error: `ยอดขั้นต่ำ ฿${coupon.min_amount}` };

  // Check applicable products
  if (coupon.applicable_products) {
    const allowed = coupon.applicable_products.split(',').map((s: string) => s.trim());
    if (allowed.length > 0 && !allowed.includes(productType)) {
      return { valid: false, error: 'รหัสส่วนลดไม่สามารถใช้กับสินค้านี้ได้' };
    }
  }

  // Check if user already used this coupon
  const used = await db.prepare(
    'SELECT id FROM billing_coupon_uses WHERE coupon_id = ? AND user_id = ?'
  ).bind(coupon.coupon_id, userId).first();
  if (used) return { valid: false, error: 'คุณใช้รหัสส่วนลดนี้แล้ว' };

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discount_type === 'PERCENT') {
    discountAmount = Math.round(originalAmount * coupon.discount_value / 100);
  } else {
    discountAmount = Math.min(coupon.discount_value, originalAmount);
  }

  return {
    valid: true,
    couponId: coupon.coupon_id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountAmount,
    finalAmount: Math.max(0, originalAmount - discountAmount),
  };
}

/** POST /validate-coupon — Check if a coupon code is valid */
billingRoutes.post('/validate-coupon', async (c) => {
  const userId = c.get('userId' as never) as string;
  const body = await c.req.json();
  const { code, productType, quantity } = body;

  const product = await c.env.DB.prepare(
    'SELECT * FROM billing_products WHERE product_type = ? AND is_active = 1'
  ).bind(productType || 'OWNER_ACCESS').first() as any;
  if (!product) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);

  const qty = productType === 'TEAM_SEAT' ? Math.max(1, quantity || 1) : 1;
  const totalAmount = product.price_thb * qty;

  const result = await validateCoupon(c.env.DB, code, userId, productType || 'OWNER_ACCESS', totalAmount);
  if (!result.valid) {
    return c.json({ ok: false, error: { code: 'INVALID_COUPON', message: result.error } });
  }

  return c.json({ ok: true, data: result });
});

/** POST /create-payment-intent — Create Stripe PaymentIntent for inline Elements (no redirect) */
billingRoutes.post('/create-payment-intent', async (c) => {
  const userId = c.get('userId' as never) as string;
  const email = (c.get('userEmail' as never) as string) || '';
  const body = await c.req.json();
  const { productType, quantity, couponCode } = body;
  const companyId = body.companyId || '';
  const now = new Date().toISOString();

  if (!productType) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing productType' } }, 400);
  }

  const product = await c.env.DB.prepare(
    'SELECT * FROM billing_products WHERE product_type = ? AND is_active = 1'
  ).bind(productType).first() as any;

  if (!product) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
  }

  const STRIPE_SECRET = c.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET) {
    return c.json({ ok: false, error: { code: 'CONFIG_ERROR', message: 'Stripe not configured' } }, 500);
  }

  const qty = productType === 'TEAM_SEAT' ? Math.max(1, quantity || 1) : 1;
  const originalAmount = product.price_thb * qty;

  // Apply coupon if provided
  let discountAmount = 0;
  let couponId = '';
  if (couponCode) {
    const couponResult = await validateCoupon(c.env.DB, couponCode, userId, productType, originalAmount);
    if (!couponResult.valid) {
      return c.json({ ok: false, error: { code: 'INVALID_COUPON', message: couponResult.error } });
    }
    discountAmount = couponResult.discountAmount || 0;
    couponId = couponResult.couponId || '';
  }

  const totalAmount = Math.max(0, originalAmount - discountAmount);

  // If 100% discount, skip Stripe and fulfill directly
  if (totalAmount <= 0) {
    const orderId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO billing_orders (order_id, user_id, company_id, order_type, quantity, amount_thb, currency, status, coupon_id, discount_amount, paid_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 'THB', 'PAID', ?, ?, ?, ?, ?)
    `).bind(orderId, userId, companyId, productType, qty, couponId, discountAmount, now, now, now).run();

    // Record coupon use
    if (couponId) {
      await c.env.DB.prepare('INSERT INTO billing_coupon_uses (id, coupon_id, user_id, order_id, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), couponId, userId, orderId, now).run();
      await c.env.DB.prepare('UPDATE billing_coupons SET used_count = used_count + 1, updated_at = ? WHERE coupon_id = ?')
        .bind(now, couponId).run();
    }

    // Grant entitlement
    if (productType === 'OWNER_ACCESS') {
      await c.env.DB.prepare('UPDATE users SET billing_status = ?, updated_at = ? WHERE user_id = ?')
        .bind('PAID', now, userId).run();
      await c.env.DB.prepare(`INSERT INTO billing_entitlements (entitlement_id, user_id, company_id, entitlement_type, granted_seats, source, order_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 'OWNER_ACCESS', 0, 'STRIPE', ?, 1, ?, ?)`).bind(crypto.randomUUID(), userId, companyId, orderId, now, now).run();
    } else if (productType === 'TEAM_SEAT') {
      await c.env.DB.prepare(`INSERT INTO billing_entitlements (entitlement_id, user_id, company_id, entitlement_type, granted_seats, source, order_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 'TEAM_SEAT', ?, 'STRIPE', ?, 1, ?, ?)`).bind(crypto.randomUUID(), userId, companyId, qty, orderId, now, now).run();
    }

    return c.json({
      ok: true,
      data: {
        orderId,
        freeOrder: true,
        amount: 0,
        originalAmount,
        discountAmount,
        currency: 'THB',
        productName: product.name,
      },
    });
  }

  // Create order record
  const orderId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO billing_orders (order_id, user_id, company_id, order_type, quantity, amount_thb, currency, status, coupon_id, discount_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'THB', 'PENDING', ?, ?, ?, ?)
  `).bind(orderId, userId, companyId, productType, qty, totalAmount, couponId, discountAmount, now, now).run();

  // Find or create Stripe customer
  let stripeCustomerId = '';
  const existingUser = await c.env.DB.prepare(
    'SELECT stripe_customer_id FROM users WHERE user_id = ?'
  ).bind(userId).first() as any;

  if (existingUser?.stripe_customer_id) {
    stripeCustomerId = existingUser.stripe_customer_id;
  } else if (email) {
    // Create Stripe customer
    const custRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ email, 'metadata[user_id]': userId }).toString(),
    });
    const cust = await custRes.json() as any;
    if (cust.id) {
      stripeCustomerId = cust.id;
      // Save to DB (add column if missing — graceful)
      try {
        await c.env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE user_id = ?')
          .bind(cust.id, userId).run();
      } catch { /* column might not exist yet */ }
    }
  }

  // Create PaymentIntent
  const piBody = new URLSearchParams({
    'amount': String(totalAmount * 100), // satang
    'currency': 'thb',
    'payment_method_types[0]': 'card',
    'payment_method_types[1]': 'promptpay',
    'metadata[order_id]': orderId,
    'metadata[user_id]': userId,
    'metadata[company_id]': companyId,
    'metadata[product_type]': productType,
    'metadata[quantity]': String(qty),
    'metadata[coupon_id]': couponId,
    'metadata[discount_amount]': String(discountAmount),
    'metadata[original_amount]': String(originalAmount),
  });
  if (stripeCustomerId) piBody.set('customer', stripeCustomerId);
  if (email && !stripeCustomerId) piBody.set('receipt_email', email);

  const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: piBody.toString(),
  });

  const pi = await piRes.json() as any;
  if (!piRes.ok) {
    return c.json({ ok: false, error: { code: 'STRIPE_ERROR', message: pi.error?.message || 'Stripe error' } }, 500);
  }

  // Update order with payment intent ID
  await c.env.DB.prepare(
    'UPDATE billing_orders SET stripe_payment_intent_id = ?, updated_at = ? WHERE order_id = ?'
  ).bind(pi.id, now, orderId).run();

  return c.json({
    ok: true,
    data: {
      orderId,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      amount: totalAmount,
      originalAmount,
      discountAmount,
      currency: 'THB',
      productName: product.name,
    },
  });
});

/** POST /update-payment-intent — Update PI amount when coupon is applied/removed */
billingRoutes.post('/update-payment-intent', async (c) => {
  const userId = c.get('userId' as never) as string;
  const body = await c.req.json();
  const { paymentIntentId, orderId, couponCode } = body;

  if (!paymentIntentId || !orderId) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing paymentIntentId or orderId' } }, 400);
  }

  const STRIPE_SECRET = c.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET) {
    return c.json({ ok: false, error: { code: 'CONFIG_ERROR', message: 'Stripe not configured' } }, 500);
  }

  // Get order to find original amount and product type
  const order = await c.env.DB.prepare(
    'SELECT * FROM billing_orders WHERE order_id = ? AND user_id = ?'
  ).bind(orderId, userId).first() as any;
  if (!order) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  const product = await c.env.DB.prepare(
    'SELECT * FROM billing_products WHERE product_type = ? AND is_active = 1'
  ).bind(order.order_type).first() as any;
  if (!product) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
  }

  const qty = order.quantity || 1;
  const originalAmount = product.price_thb * qty;

  // Calculate new amount with coupon
  let discountAmount = 0;
  let couponId = '';
  if (couponCode) {
    const couponResult = await validateCoupon(c.env.DB, couponCode, userId, order.order_type, originalAmount);
    if (!couponResult.valid) {
      return c.json({ ok: false, error: { code: 'INVALID_COUPON', message: couponResult.error } });
    }
    discountAmount = couponResult.discountAmount || 0;
    couponId = couponResult.couponId || '';
  }

  const totalAmount = Math.max(0, originalAmount - discountAmount);

  // If 100% discount — cancel existing PI and fulfill directly
  if (totalAmount <= 0) {
    const now = new Date().toISOString();
    // Cancel the existing PI at Stripe
    try {
      await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch { /* ignore cancel errors */ }

    // Update order to PAID with 0 amount
    await c.env.DB.prepare(`
      UPDATE billing_orders SET status = 'PAID', amount_thb = 0, coupon_id = ?, discount_amount = ?, paid_at = ?, updated_at = ?
      WHERE order_id = ?
    `).bind(couponId, discountAmount, now, now, orderId).run();

    // Record coupon use
    if (couponId) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO billing_coupon_uses (id, coupon_id, user_id, order_id, used_at) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), couponId, userId, orderId, now).run();
      await c.env.DB.prepare('UPDATE billing_coupons SET used_count = used_count + 1, updated_at = ? WHERE coupon_id = ?')
        .bind(now, couponId).run();
    }

    // Grant entitlement
    const productType = order.order_type;
    if (productType === 'OWNER_ACCESS') {
      await c.env.DB.prepare('UPDATE users SET billing_status = ?, updated_at = ? WHERE user_id = ?')
        .bind('PAID', now, userId).run();
      await c.env.DB.prepare(`INSERT INTO billing_entitlements (entitlement_id, user_id, company_id, entitlement_type, granted_seats, source, order_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 'OWNER_ACCESS', 0, 'STRIPE', ?, 1, ?, ?)`).bind(crypto.randomUUID(), userId, order.company_id || '', orderId, now, now).run();
    } else if (productType === 'TEAM_SEAT') {
      await c.env.DB.prepare(`INSERT INTO billing_entitlements (entitlement_id, user_id, company_id, entitlement_type, granted_seats, source, order_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 'TEAM_SEAT', ?, 'STRIPE', ?, 1, ?, ?)`).bind(crypto.randomUUID(), userId, order.company_id || '', qty, orderId, now, now).run();
    }

    return c.json({
      ok: true,
      data: {
        freeOrder: true,
        amount: 0,
        originalAmount,
        discountAmount,
        productName: product.name,
      },
    });
  }

  // Update PI amount at Stripe
  const updateBody = new URLSearchParams({
    'amount': String(totalAmount * 100),
    'metadata[coupon_id]': couponId,
    'metadata[discount_amount]': String(discountAmount),
    'metadata[original_amount]': String(originalAmount),
  });

  const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: updateBody.toString(),
  });

  const pi = await piRes.json() as any;
  if (!piRes.ok) {
    return c.json({ ok: false, error: { code: 'STRIPE_ERROR', message: pi.error?.message || 'Failed to update payment' } }, 500);
  }

  // Update order in DB
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE billing_orders SET amount_thb = ?, coupon_id = ?, discount_amount = ?, updated_at = ? WHERE order_id = ?'
  ).bind(totalAmount, couponId, discountAmount, now, orderId).run();

  return c.json({
    ok: true,
    data: {
      amount: totalAmount,
      originalAmount,
      discountAmount,
      clientSecret: pi.client_secret,
      productName: product.name,
    },
  });
});

// --- Stripe Webhook Signature Verification ---

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  if (!secret || !sigHeader) return false;
  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, part: string) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const timestamp = parts['t'];
  const v1Sig = parts['v1'];
  if (!timestamp || !v1Sig) return false;

  // Reject if timestamp is too old (5 min tolerance)
  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === v1Sig;
}

async function processWebhook(db: D1Database, body: string, sig: string | undefined, webhookSecret: string): Promise<{ ok: boolean; status: number; message: string }> {
  // Verify signature if secret is configured
  if (webhookSecret) {
    if (!sig) return { ok: false, status: 400, message: 'Missing stripe-signature header' };
    const valid = await verifyStripeSignature(body, sig, webhookSecret);
    if (!valid) return { ok: false, status: 400, message: 'Invalid signature' };
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return { ok: false, status: 400, message: 'Invalid JSON' };
  }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    // Handle both Checkout Session and PaymentIntent webhooks
    const obj = event.data.object;
    const orderId = obj.metadata?.order_id;
    const userId = obj.metadata?.user_id;
    const companyId = obj.metadata?.company_id;
    const productType = obj.metadata?.product_type;
    const paymentIntentId = event.type === 'checkout.session.completed' ? (obj.payment_intent || '') : obj.id;
    const now = new Date().toISOString();

    if (orderId && userId) {
      // Check if already processed (idempotency)
      const existing = await db.prepare(
        'SELECT status FROM billing_orders WHERE order_id = ?'
      ).bind(orderId).first() as any;
      if (existing?.status === 'PAID') {
        return { ok: true, status: 200, message: 'Already processed' };
      }

      // Update order
      await db.prepare(`
        UPDATE billing_orders SET status = 'PAID', stripe_payment_intent_id = ?, paid_at = ?, updated_at = ?
        WHERE order_id = ?
      `).bind(paymentIntentId, now, now, orderId).run();

      // Create entitlement
      const entitlementId = crypto.randomUUID();
      const seats = productType === 'TEAM_SEAT' ? (parseInt(obj.metadata?.quantity || '1', 10) || 1) : 0;

      await db.prepare(`
        INSERT INTO billing_entitlements (entitlement_id, user_id, company_id, entitlement_type, granted_seats, source, order_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'STRIPE', ?, 1, ?, ?)
      `).bind(entitlementId, userId, companyId || '', productType, seats, orderId, now, now).run();

      // Update user billing_status to PAID if OWNER_ACCESS
      if (productType === 'OWNER_ACCESS') {
        await db.prepare(
          'UPDATE users SET billing_status = ?, updated_at = ? WHERE user_id = ?'
        ).bind('PAID', now, userId).run();
      }

      // Record coupon usage if present
      const couponId = obj.metadata?.coupon_id;
      if (couponId) {
        try {
          await db.prepare('INSERT OR IGNORE INTO billing_coupon_uses (id, coupon_id, user_id, order_id, used_at) VALUES (?, ?, ?, ?, ?)')
            .bind(crypto.randomUUID(), couponId, userId, orderId, now).run();
          await db.prepare('UPDATE billing_coupons SET used_count = used_count + 1, updated_at = ? WHERE coupon_id = ?')
            .bind(now, couponId).run();
        } catch { /* ignore if already recorded */ }
      }
    }
  }

  return { ok: true, status: 200, message: 'received' };
}

/** Exported standalone handler for use in index.ts (no auth) */
export async function handleStripeWebhook(c: Context<{ Bindings: Env }>) {
  const body = await c.req.text();
  const sig = c.req.header('stripe-signature') || undefined;
  const result = await processWebhook(c.env.DB, body, sig, c.env.STRIPE_WEBHOOK_SECRET || '');
  return c.json({ ok: result.ok, message: result.message }, result.status as any);
}

/** POST /webhook — kept for sub-router compatibility */
billingRoutes.post('/webhook', async (c) => {
  return handleStripeWebhook(c as any);
});

/** GET /verify-session — Verify a Stripe checkout session (for success page) */
billingRoutes.get('/verify-session', async (c) => {
  const userId = c.get('userId' as never) as string;
  const sessionId = c.req.query('session_id');
  if (!sessionId) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Missing session_id' } }, 400);
  }

  // Look up order by stripe_session_id
  const order = await c.env.DB.prepare(
    'SELECT * FROM billing_orders WHERE stripe_session_id = ? AND user_id = ?'
  ).bind(sessionId, userId).first() as any;

  if (!order) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
  }

  // If still PENDING, check with Stripe directly
  if (order.status === 'PENDING') {
    const STRIPE_SECRET = c.env.STRIPE_SECRET_KEY;
    if (STRIPE_SECRET) {
      try {
        const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` },
        });
        const session = await stripeRes.json() as any;
        if (session.payment_status === 'paid') {
          // Process the payment (webhook might not have arrived yet)
          const now = new Date().toISOString();
          await c.env.DB.prepare(`
            UPDATE billing_orders SET status = 'PAID', stripe_payment_intent_id = ?, paid_at = ?, updated_at = ?
            WHERE order_id = ?
          `).bind(session.payment_intent || '', now, now, order.order_id).run();

          // Create entitlement if not exists
          const existing = await c.env.DB.prepare(
            'SELECT entitlement_id FROM billing_entitlements WHERE order_id = ?'
          ).bind(order.order_id).first();
          if (!existing) {
            const entitlementId = crypto.randomUUID();
            const seats = order.order_type === 'TEAM_SEAT' ? (order.quantity || 1) : 0;
            await c.env.DB.prepare(`
              INSERT INTO billing_entitlements (entitlement_id, user_id, company_id, entitlement_type, granted_seats, source, order_id, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'STRIPE', ?, 1, ?, ?)
            `).bind(entitlementId, userId, order.company_id || '', order.order_type, seats, order.order_id, now, now).run();
          }

          if (order.order_type === 'OWNER_ACCESS') {
            await c.env.DB.prepare(
              'UPDATE users SET billing_status = ?, updated_at = ? WHERE user_id = ?'
            ).bind('PAID', now, userId).run();
          }

          return c.json({ ok: true, data: { status: 'PAID', orderType: order.order_type } });
        }
      } catch {}
    }
    return c.json({ ok: true, data: { status: 'PENDING', orderType: order.order_type } });
  }

  return c.json({ ok: true, data: { status: order.status, orderType: order.order_type } });
});

/** GET /orders — List orders for current user */
billingRoutes.get('/orders', async (c) => {
  const userId = c.get('userId' as never) as string;
  const rows = await c.env.DB.prepare(
    'SELECT * FROM billing_orders WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();

  return c.json({
    ok: true,
    data: (rows.results || []).map((o: any) => ({
      orderId: o.order_id,
      orderType: o.order_type,
      quantity: o.quantity,
      amountThb: o.amount_thb,
      status: o.status,
      paidAt: o.paid_at,
      createdAt: o.created_at,
    })),
  });
});
