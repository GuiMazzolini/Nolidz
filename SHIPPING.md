# nolidz — Shipping and Carriers

Everything about how a parcel gets sold, priced, booked and tracked: the
methods on offer, where their prices live, which carrier APIs are involved,
what each one costs to get access to, and what is currently blocking us.

Written 2026-08-21. Code references are to `app/lib/shipping.ts`,
`app/lib/carriers.ts`, `app/lib/dhl.ts`, `app/lib/dpd.ts` and
`app/lib/tracking.ts`.

---

## Status at a glance

| Piece | State | Blocker |
|---|---|---|
| Standard delivery (DHL) sold at checkout | ✅ live | — |
| Express delivery (DHL Express) sold at checkout | ✅ live | — |
| DPD sold at checkout | ⏸️ **held back** | DPD business contract not signed |
| DHL tracking (both services) | ⚠️ **code ready, no key** | **DHL rejected our production API request — see below** |
| DPD tracking | ⚠️ code ready, unverified, no credentials | DPD contract |
| Label creation / booking (any carrier) | ❌ not built | Out of scope so far; parcels are booked by hand |

Two independent things are missing, and they fail differently. Read
[Carrier access](#carrier-access-contracts-and-credentials) before assuming
either is a code problem.

---

## What we sell

Delivery is chosen by the buyer **on Stripe's hosted Checkout page**, not in our
cart. Our cart quotes standard delivery as a floor and says so.

| Method | id | Carrier written to the order | Price | Free over €100? | Estimate | Offered? |
|---|---|---|---|---|---|---|
| Standard delivery | `standard` | `DHL` | €5 | ✅ yes | 2–4 business days | ✅ |
| DPD delivery | `dpd` | `DPD` | €4 | ❌ no | 2–4 business days | ⏸️ **held back** |
| Express delivery | `express` | `DHL Express` | €15 | ❌ no | 1–2 business days | ✅ |

> ⚠️ **The €4 and €15 are placeholders.** They were chosen to be plausible for
> the German market, not quoted from a rate card. Replace them with your real
> contracted rates before this matters. €5 standard and the €100 threshold are
> pre-existing and unchanged.

All of this lives in `SHIPPING_METHODS` in `app/lib/shipping.ts` **and nowhere
else**. The cart quote, the product-page line, the Stripe rates and the carrier
written onto the order are all derived from that one list, so a price change is
one edit.

### Delivery area

Germany only. `SHIPPING_COUNTRIES = ["DE"]` gates Stripe's
`shipping_address_collection`, so Checkout will refuse any other address.
`SHIPPING_AREA_LABEL` and the `common.shippingArea` dictionary key must keep
saying the same thing in both languages — a storefront that says "the EU" while
Checkout accepts only DE reads as a yes to an Austrian shopper right up until
Stripe refuses their address.

Visitors who look foreign at the edge get a dismissible banner and nothing more
(`isOutsideShippingArea`). It never blocks a purchase: IP is a poor proxy for a
delivery address, and a German customer on a VPN must not be turned away.

### The free-shipping rule

Free over €100 applies to **standard delivery only** (`freeOverThreshold: true`).

The threshold exists to nudge basket size. A free upgrade to next-day air costs
several times the margin it was meant to buy, so express and DPD keep their full
rate however large the basket is. The threshold is measured against the
**subtotal**, so paying for express can never push an order over the line into
free shipping it had not earned.

### Holding DPD back

DPD carries `offered: false`. `OFFERED_SHIPPING_METHODS` filters it out and
checkout never renders it — a rate on the Checkout page is an offer we would
have to honour, and we cannot yet book or track a DPD parcel.

It stays in the catalogue rather than being deleted so that:

- its price and carrier stay reviewable in one place,
- `getShippingMethod("dpd")` still resolves, so any order that ever chose it
  reads back correctly after it is withdrawn again,
- going live is one boolean plus credentials.

A test in `app/api/checkout/route.test.ts` asserts `dpd` never reaches a Stripe
rate, so it cannot leak into checkout by accident.

---

## How a delivery choice travels

```
cart page          quotes standard only (getShippingCost) — a floor, labelled as such
   │
   ▼
POST /api/checkout builds one Stripe shipping_rate_data per OFFERED method:
   │                 · display_name  → translated, from the api dictionary
   │                 · fixed_amount  → getShippingCostFor(method, subtotal)
   │                 · delivery_estimate → business days
   │                 · metadata      → { methodId, carrier }   ← the durable link
   ▼
Stripe Checkout    buyer picks one; Stripe charges it
   │
   ▼
Stripe webhook  →  fulfillCheckoutSession retrieves the session with
   │                 expand: ["line_items", "shipping_cost.shipping_rate"]
   ▼
buildOrderFromStripeSession
   │                 readShippingMethod() reads metadata.methodId
   │                 order.shippingMethod = what was sold  (immutable)
   │                 order.carrier        = prefilled from that method
   ▼
admin ship form    admin can correct `carrier` if it went out another way,
   │                 and adds the tracking number
   ▼
refreshTrackingForOrder → routes by carrier, caches the result on the order
```

### Why `metadata.methodId` and not the display name

Display names are customer-facing copy sent in the buyer's language and will be
reworded. The method id is what fulfillment reads. Deriving the carrier from a
translated string would break the first time someone edits German copy.

Stripe reports the *amount* a buyer paid, but not the *choice* behind it — two
methods can cost the same. The metadata is the only durable record.

**Gotcha:** `shipping_cost.shipping_rate` arrives as a bare id string unless it
is expanded on retrieve. Anything reading the method must expand it, or it will
silently fall back to standard. `readShippingMethod` handles all three cases
(expanded, unexpanded, absent) by falling back to `standard`, which is correct
for every order placed before buyers had a choice.

---

## Carriers and tracking

`app/lib/carriers.ts` is the single place that turns a free-text carrier string
into something actionable. The ship form has always accepted free text, so
orders exist with `"UPS"` and `"CTT"` on them, and orders placed since the
checkout change carry a carrier we wrote ourselves.

```
carrierFromText("dhl express")  →  "dhl-express"
trackerForCarrier("dhl express") →  { kind: "dhl", service: "express" }
trackerForCarrier("DPD")         →  { kind: "dpd" }
trackerForCarrier("UPS")         →  null
```

Matching is deliberately loose — it reads what an admin typed under time
pressure. Express is matched **before** DHL, because `"dhl express"` contains
`"dhl"` and the narrower match has to win or every express parcel would be
looked up as a domestic one. A blank carrier falls back to DHL, because every
order predating the carrier field was a German DHL parcel.

Both clients return the same `TrackingResult` union, so the refresh floor, the
terminal-status rule and the admin UI are all carrier-agnostic. A third carrier
is a new `kind` here, not a second pipeline.

### Three different "no"s

These are reported separately on purpose, because they call for different fixes:

| Outcome | Meaning | What to do |
|---|---|---|
| `carrier-not-supported` | No integration exists (UPS, GLS, Hermes) | Track it on the carrier's own site |
| `not-configured` | Integration exists, credentials missing | Set the env vars |
| `not-found` | Carrier has never seen this number | Usually normal for hours after a label is printed |

`isTrackableCarrier` deliberately ignores whether credentials are set. A shop
with no DPD contract still ships DPD parcels by hand, and the admin must be told
"not configured", not "unsupported".

### Budget discipline

DHL's approved rate limit is **250 requests per day**, which is trivial to burn.
The whole tracking design is built around that:

- **Nothing fetches during a render.** Pages read cached fields off the order. A
  crawler hitting every order page costs zero carrier requests.
- **Six-hour refresh floor** (`TRACKING_REFRESH_FLOOR_MS`). A parcel moves a
  handful of times a day; anything finer spends budget re-reading the same line.
- **Terminal statuses are permanently fresh.** Once `delivered` or `failure`,
  DHL has nothing more to say. `force` skips the time floor but never this — an
  admin clicking repeatedly on a delivered parcel would drain the day.
- **One HTTP call, no retries.** Retrying inside a 250/day budget spends
  tomorrow's allowance on today's outage. A missed refresh costs nothing: the
  cached status stays on screen.
- **The refresh route is admin-only** — not because the status is secret (the
  customer sees it on their own order page) but because it is the only route
  that can spend the budget.

---

## Carrier access: contracts and credentials

### DHL — Shipment Tracking (Unified)

One endpoint, one header, covers **both** standard (`parcel-de`) and express
(`express`) as service codes on the same key. Self-service signup at
[developer.dhl.com](https://developer.dhl.com) → My Apps.

> ### 🚫 Current blocker: production access rejected
>
> ```
> Request No:        202115
> API Name:          Shipment Tracking - Unified
> Rate Limit:        250 requests every 1 day
> App Name:          nolidz_shipping
> Environment:       Production (Europe)
> Approver's comment: For successful approval, please submit your request using
>                     a business email address associated with your company domain.
> ```
>
> **This is not a technical rejection.** The integration, the rate limit and the
> app name were all accepted as reasonable — DHL only objects to the email
> address the request came from. A free-mail address (gmail, gmx, web.de …)
> will be refused every time.
>
> **To fix:** resubmit the same request from an address on the nolidz domain,
> e.g. `you@nolidz.de`. That means the domain needs working mail first —
> a forwarding-only mailbox at the registrar is enough; it does not need a full
> mail suite. Keep the app name and the 250/day limit identical so it reads as a
> resubmission rather than a new ask.
>
> **Until then:** `DHL_API_KEY` stays unset, tracking reports `not-configured`,
> and the admin sees "credentials for this carrier are not set". Nothing else
> breaks — orders sell, ship, email, and display their tracking number. Only
> the status polling is dark.
>
> The **sandbox/test** environment does not have the business-email requirement
> and can be used to exercise the client in the meantime.

**Not needed:** `DHL_API_SECRET`. That is for Parcel DE Shipping v2 (label
creation, OAuth2), which needs a full DHL business contract and is not built.

### DPD Germany — parcel tracking

**There is no self-service signup.** Unlike DHL you cannot get a key from a
developer portal. Access requires:

1. A **DPD Germany business customer account** (a Kundennummer), which means a
   shipping contract with volume commitments — talk to DPD sales.
2. **API access granted against that account** (myDPD / DPD Cloud web services).
3. DPD then issues a **delisId** and **password**, and tells you which host to
   use. Those are traded for a short-lived auth token by the LoginService, and
   that token carries the tracking call.

The client caches the auth token in module memory, because DPD rate-limits
*logins* far harder than lookups and re-authenticating per parcel is the
quickest way to get the account throttled. A 401 clears the cache so a stale
token cannot poison every later lookup.

> ⚠️ **The DPD client has never run against the live API.** It is written to
> DPD's documented login-then-`parcellifecycle` shape. Before switching
> `offered: true`, check `parseDpdResponse` and `mapDpdStatus` against a real
> sandbox response. `app/lib/dpd.test.ts` pins the current assumptions, so a
> mismatch will show up there rather than in production.
>
> One assumption worth verifying first: DPD returns the whole scan history with
> the reached entries flagged, and the unreached tail is a *forecast*. We read
> the last **reached** scan. Taking the last entry outright would report a
> parcel delivered while it is still in transit.

### If the contracts are not worth it

DPD's contract only makes sense at volume. Cheaper routes to the same tracking:

- **Aggregators** — AfterShip, Sendcloud, TrackingMore, EasyPost, 17TRACK. One
  contract covers many carriers, usually with a free tier in the low hundreds of
  parcels a month. This would slot in as a third `CarrierTracker` kind
  (`{ kind: "aggregator" }`) behind the same interface; nothing downstream
  changes.
- **Sendcloud** specifically is worth a look for a German shop — it also covers
  label buying without a direct carrier contract, which is the piece we have not
  built at all.
- **Do nothing.** Show the tracking number as a link to the carrier's own site.
  Costs nothing, works for every carrier, loses the status-in-admin feature.

---

## Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `DHL_API_KEY` | for DHL tracking | Shipment Tracking Unified. Covers standard **and** express. **Currently unobtainable — see blocker above.** |
| `DHL_API_SECRET` | no | Label creation (Parcel DE Shipping v2). Not built. |
| `DPD_API_URL` | all three together | DPD host, confirmed by DPD |
| `DPD_DELIS_ID` | all three together | DPD-issued account id |
| `DPD_PASSWORD` | all three together | DPD-issued password |

Unset is a supported state everywhere. With any one DPD var missing, DPD is
treated as unconfigured. All are documented in `.env.example`.

---

## Going live: checklists

### Switching DHL tracking on

1. Get a mailbox on the nolidz domain.
2. Resubmit DHL request 202115 from that address, same app name, same 250/day.
3. Set `DHL_API_KEY` in the deployment environment.
4. Ship a real parcel, hit **Check carrier status** in the admin, confirm a
   status comes back. Both service codes are worth testing — a standard parcel
   and an express one.

### Switching DPD on

1. Sign the DPD business contract, get API access, receive delisId + password.
2. Set `DPD_API_URL`, `DPD_DELIS_ID`, `DPD_PASSWORD`.
3. **Verify the response shape** against a sandbox parcel; correct
   `parseDpdResponse` / `mapDpdStatus` and their tests if DPD's payload differs.
4. Replace the placeholder €4 with the real contracted rate.
5. Flip `offered: true` on the `dpd` entry in `SHIPPING_METHODS`.
6. Update the `dpd` entry in `app/i18n/dictionaries/api.{en,de}.ts` if the
   customer-facing name should read differently.
7. `npm run typecheck && npm run lint && npm test && npm run build`.

### Adding a fourth carrier

1. Add it to `SHIPPING_METHODS` with `offered: false` and a `carrier` string.
2. Add its name to `shippingMethods` in **both** api dictionaries — the checkout
   route indexes that object by method id, so a missing key is a type error.
3. Teach `carrierFromText` to recognise the carrier string, and add it to
   `TRACKERS`.
4. Add a `CarrierTracker` kind, a client returning `TrackingResult`, and a case
   in `fetchFromCarrier` and `isTrackerConfigured`.
5. Add it to `CARRIER_SUGGESTIONS` in the admin ship form.

---

## Related things that touch shipping

- **Stock holds.** A checkout holds stock for `CHECKOUT_HOLD_MINUTES` (30),
  capped at `MAX_OPEN_HOLDS_PER_BUYER` (3), and the Stripe session expires on
  the same clock. Shipping method has no effect on any of this. See the README.
- **Checkout rate limit.** 10 per hour per IP (`RATE_LIMITS.checkout`), which
  bounds inventory as well as load.
- **Emails.** The shipping notification includes the carrier and tracking
  number, sent in the locale stored on the order — the buyer's request is long
  gone by the time an admin marks it shipped.
- **Legal copy.** German price-indication rules expect delivery costs and
  timeframes to be findable before checkout. The product page and cart both
  state the rates and the delivery area, and the estimates now ride along on the
  Stripe rates. If prices change, `/widerruf` and the product-page line should
  be re-read for consistency. *(Not legal advice — worth a lawyer's eye before
  launch.)*

---

## Open decisions

| Question | Current state | Needs |
|---|---|---|
| Express price | €15 placeholder | Real DHL Express rate card |
| DPD price | €4 placeholder | Real DPD rate card |
| Is DPD worth a contract at our volume? | Assumed yes, held back | Volume forecast, or pick an aggregator |
| Label creation / booking | Not built, parcels booked by hand | Decide when manual booking stops scaling |
| Business email for DHL | Missing | Mailbox on the nolidz domain |
