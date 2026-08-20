# StyleShop — Code Review

Reviewed at `10f5094`, updated after the P0 remediation pass, then again at
`3a0852b` after the P1 pass.
Verified by running: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit`, plus runtime checks against a live MongoDB.

## Status

| Gate | At review | After P0 | Now |
|---|---|---|---|
| `npm run typecheck` | 13 errors | 0 | **0** |
| `npm run build` | ❌ failed | ✅ passes | **✅ passes** |
| `npm test` | 17 pass | 42 pass (6 files) | **638 pass** (49 files) |
| `npm run lint` | clean | clean | **clean** |
| `npm audit` | 12 vulns, 2 critical | 0 | **0** |

**Fixed in the P0 pass:** broken build (typed Mongo collections), `next` 16.0.4→16.3.0 + `next-auth` 4.24.15 (cleared a CVSS 10.0 RCE and an OAuth cookie-binding flaw), NoSQL operator injection (Zod on every route), rate limiting, unauthenticated writes on `/checkout/success`, cross-tenant cart wipe, security headers, unique DB indexes, image-host allowlist, order-email case sensitivity, Stripe metadata overflow.

**Fixed in the P1 pass:** the duplicated cart join, the duplicated `requireAdmin`, the last untested route handler, and `CartItem`'s missing `"use client"`. Details below.

Nothing critical or high is open, and P1 is now clear. What remains is P2 polish.

---

## What's left

### P1 — cleared

**1. The cart join was duplicated 3×.** ✅ Done.
`app/api/cart/route.ts`, `app/api/cart/merge/route.ts`, and `app/cart/page.tsx` each rebuilt "fetch products by id → attach quantities → normalize stock." (The review said 4× and named `app/checkout/page.tsx`; that page no longer exists.) All three now call `loadCartProducts(db, items)` from `app/lib/cart-server.ts`. Net −174/+32 lines across the touched files.

`serializeProduct` had already been extracted to `app/lib/admin-products.ts`. `requireAdmin` was copy-pasted in three route files by this point, with a fourth copy inlined in the tracking route; all four now use `requireAdmin`/`adminUnauthorized` from `app/lib/admin-auth.ts`. It is kept apart from `admin.ts` so `isAdminEmail` stays a pure function importable without dragging next-auth in behind it.

**2. No route-handler or component tests.** ✅ Done.
The suite now covers all 17 route handlers and the components. The last handler at 0% was `POST /api/admin/orders/[sessionId]/tracking` — the only route that can spend the daily DHL budget, so its 401 is a budget control and not merely a privacy one. It now has 21 tests covering the admin gate, the `force` flag, and every DHL failure reason's status mapping.

`vitest.config.mts` already handles both environments: node by default, with component files opting into jsdom via a `@vitest-environment jsdom` docblock.

*Note on measuring this:* v8's text reporter silently omits the most deeply-nested file in a table while still counting it toward the aggregate, so per-file coverage numbers for `webhooks/stripe/route.ts` and the tracking route read as absent or 0 when they are neither. The suite was verified by mutation instead — removing the admin check, weakening `force === true` to a truthiness test, downgrading the throttled 429, dropping either cart-join guard, and replacing the single `$in` with a per-line query each fail tests.

**3. Two non-selector store subscriptions.** ✅ Already fixed before this pass.
All 17 `useCartStore` call sites use selectors. `ProductsList.tsx` no longer touches the store at all.

**4. `CartItem.tsx` is missing `"use client"`.** ✅ Done. One line. It has three `useCartStore` hooks and had been working only because `ShoppingCartList.tsx` imports it as a client component.

### P2 — polish

Not re-verified in the P1 pass — the items below are as recorded at the P0 review and some may already be stale.

- **Wrong GitHub URL.** `app/page.tsx:6` and the README point at `github.com/GuiMazzolini/e-commerce-NextJs`, and the README credits `GuiMazzolini`. Every "Inspect the code" button sends visitors to someone else's repo.
- ~~**Dead API routes.**~~ **Done.** Removed unused `GET /api/products`, `GET /api/products/[id]`, `GET /api/admin/products`, `GET /api/admin/products/[id]`, and `GET /api/account` (storefront/admin load via RSC; account profile via `getAccountProfile`).
- **Inline Tailwind duplication.** The primary-button class string appears in ~9 files with drift (`px-6` vs `px-8`, etc.). Three components — `<Button>`, `<Card>`, `<Input>` — plus `clsx` would fix it. Note `ProductsList.tsx:216` has `${loading && "..."}`, which renders the string `"false"` into `className`.
- **Two large files.** `ProductForm.tsx` (395 lines — split out the upload field and a `useProductForm` hook) and `app/page.tsx` (361 lines of marketing markup — extract `<Hero>`, `<CaseStudy>`, `<Featured>`, `<CTA>`).
- **`unoptimized` on all 6 `<Image>` call sites** bypasses Next's optimizer and `srcset`. Mobile downloads a 1200px asset for a 96px thumbnail. Either drop the flag or add a Cloudinary loader so `sizes` produces a real srcset.
- **Money as floats.** Rounding at the Stripe boundary is correct, so no charge is wrong today, but subtotals accumulate in floats before the free-shipping comparison. Store integer cents.
- **One `error.tsx` at root only.** Add per-segment boundaries for `products/`, `cart/`, `orders/`, `admin/` — `loading.tsx` coverage is already good, mirror it.
- **No Prettier/Husky.** Formatting drifts across files. Add Prettier + lint-staged so the CI typecheck gate isn't the first thing to catch a mistake.
- **No error tracking.** 8 `console.error`/`warn` calls go nowhere. The `console.warn` at `orders.ts` (stock decrement skipped on a *paid* order) is money-affecting and should alert. Add Sentry.
- ~~**Stock isn't reserved**~~ — **obsolete.** Stock is now held at checkout and either committed or released exactly once (`app/lib/stock-hold.ts`, `app/lib/reservations.ts`); the Stripe webhook releases the hold on `checkout.session.expired` and `async_payment_failed`, and the checkout route puts it back if Stripe fails to create the session. The admin product form reconciles against held units rather than writing shelf counts verbatim.

---

## Deployment notes

- **CSP ships as report-only.** Check the browser console for violations, then rename the header to `Content-Security-Policy`.
- **The unique indexes will fail to build against a database that already has duplicate emails or product ids.** Check and dedupe before deploying.
- **Leave `STRIPE_WEBHOOK_SECRET` unset in local dev** unless `stripe listen` is running — it now decides whether the webhook or the success page fulfills orders.
