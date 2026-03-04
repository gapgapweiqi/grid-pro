# Landing Page & SaaS Infrastructure

## New Routes

| Route | Description | Status |
|-------|-------------|--------|
| `/landing` | Landing page — hero, features, doc types, platforms, pricing preview, CTA, footer | ✅ |
| `/login` | Login/Register page — Google, LINE, email/password (mock) | ✅ |
| `/pricing` | Pricing page — 3 plans, billing toggle, FAQ accordion | ✅ |

## Landing Page Sections
1. **Hero** — Headline + gradient text + CTA buttons + trust badges + app mockup
2. **Features** — 6 feature cards (documents, stock, dashboard, multi-company, VAT/WHT, cross-platform)
3. **Document Types** — 10 doc type chips with accent colors
4. **Platforms** — macOS, Windows, Mobile, Web Browser cards
5. **Pricing Preview** — Mini pricing cards from `pricing.ts`
6. **CTA** — Gradient call-to-action box
7. **Footer** — Brand, product links, help links, legal links

## Login Page
- Google OAuth button (mock → Phase 3)
- LINE Login button (mock → Phase 3)
- Email/password form (mock → Phase 3)
- Toggle login/register mode
- Redirect to dashboard on success

## Design System
- Style: Clean, premium, modern
- Colors: Uses CSS variables from theme system
- Fonts: Sarabun (Thai) + system fonts
- Responsive: Mobile-first, works on all screen sizes
- No external UI library dependencies

## Future Work
- [ ] Connect Google OAuth (Phase 3)
- [ ] Connect LINE Login (Phase 3)
- [ ] Stripe Checkout integration (Phase 2)
- [ ] Auth guard middleware
- [ ] Subscription status display in sidebar
