# Stripe Integration Plan

## Overview
เชื่อมต่อ Stripe สำหรับระบบ subscription ของ SaaS — รองรับ 3 แพลน: Free, Pro, Enterprise

## Pricing Plans

| Plan | Price/mo | Yearly | Companies | Docs/mo | Users |
|------|----------|--------|-----------|---------|-------|
| Free | ฟรี | ฟรี | 1 | 20 | 1 |
| Pro | ฿299 | ฿2,990 | 3 | ไม่จำกัด | 3 |
| Enterprise | ฿799 | ฿7,990 | ไม่จำกัด | ไม่จำกัด | ไม่จำกัด |

## Config File
`lib/config/pricing.ts` — Plans, features, limits, FAQ

## Implementation Phases

### Phase 1 (Current — UI Only)
- ✅ `pricing.ts` — Config + Plans + FAQ
- ✅ `/pricing` — Pricing page with billing toggle
- ✅ `/landing` — Landing page with pricing preview
- ✅ `/login` — Mock login page
- ⏳ Subscription badge component (placeholder)

### Phase 2 (Cloudflare Workers)
- Stripe Customer creation on signup
- Stripe Checkout Session for upgrade
- Stripe Customer Portal for manage/cancel
- Webhook handler: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted`
- D1 table: `subscriptions` (userId, planId, stripeSubId, status, currentPeriodEnd)

### Phase 3 (Enforcement)
- Middleware to check subscription limits
- Feature gating based on plan
- Usage tracking (docs per month, storage)
- Upgrade prompts when limits reached

## Stripe API Keys
- **STRIPE_SECRET_KEY** — Server-side only (Cloudflare Worker env)
- **STRIPE_PUBLISHABLE_KEY** — Client-side (for Stripe.js)
- **STRIPE_WEBHOOK_SECRET** — For webhook signature verification

## Payment Methods
- Credit/Debit cards (Visa, Mastercard, JCB)
- PromptPay (via Stripe Thailand)

## Security Notes
- Never expose secret key in frontend
- Always verify webhook signatures
- Use Stripe Customer Portal for subscription management
- Store minimal billing data in own DB
