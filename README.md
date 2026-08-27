# nolidz

A Next.js storefront: catalog, cart, Stripe Checkout, order history, and an
admin area for inventory.

Products can sell as a single SKU or by **EU size and colour**, where each
size/colour combination carries its own SKU and stock count. A cart line is
identified by product *and* variant, so two sizes of the same shoe are two
independent lines with independent stock.

## Running the tests

```bash
npm install
npm test
```

That is the whole setup. No database to install, configure, or start — the
tests that need a real MongoDB share one throwaway server, started before the
run and deleted when it finishes. The first run downloads a MongoDB binary (~100 MB,
cached afterwards), so it takes a minute longer than the rest.

```bash
npm test              # everything
npm run test:watch    # re-run on save
npm run test:coverage
```

If that download cannot happen — no network on a first run, say — those tests
report themselves as **skipped** rather than failing, and the other ~330 keep
running. Nothing is silently lost: skipped shows up in the output.

### The two kinds of test

Most tests need no database at all. Route handlers run against an in-memory
stand-in (`app/test/mongo-double.ts`) that applies the query and update
operators this app actually uses, so a handler that selects the wrong cart line
fails a test instead of passing quietly.

Files named `*.integration.test.ts` run against a genuine MongoDB, covering
what a stand-in cannot vouch for — that an update lands on the array element we
think it does, and that the unique index on `users.email` really does reject a
second signup that arrives at the same moment.

```bash
npm run test:integration    # just those
```

One of them, `app/test/smoke.integration.test.ts`, is not about a single
handler at all: it walks one purchase through the real routes from signup to
order confirmation — sign in, an admin publishes a product with its image, a
basket, a checkout that holds stock, and Stripe's webhook. Everything it
touches has its own tests; what it catches is those parts no longer meeting.
When a webhook stops reaching fulfillment the stock stays held, the product
drops off the storefront and the buyer has no order to look up, and every
narrower test still passes.

To run them against a database you already have instead of a throwaway one:

```bash
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:integration
```

This is safe to point at a development database. Test databases are always
named `nolidz_test_*`, they are dropped when the run ends, and teardown refuses
to drop anything without that prefix. CI uses this path, against a MongoDB it
starts as a service container.

## Running the app

Unlike the tests, the app needs a real database.

```bash
cp -n .env.example .env.local   # -n: never overwrite an existing .env.local
npm run db:start                # a local MongoDB in Docker — or use a cloud one
npm run seed                    # sample catalog, including a sized product
npm run dev
```

Then open `.env.local` and fill it in. The one value the app cannot start
without is `MONGODB_URI`; for a local database that is:

```
MONGODB_URI=mongodb://127.0.0.1:27017
```

The database name defaults to `nolidz`. If an older environment still stores
data under `ecommerce-nextjs`, set `MONGODB_DB=ecommerce-nextjs` so you do not
point at an empty database by accident.

`NEXTAUTH_SECRET` also needs any random string — `openssl rand -base64 32`
generates one. Changing it later signs everyone out. Stripe, Cloudinary, and
the OAuth keys are optional in development; the app runs without them and only
the features that use them are unavailable.

Before a production deploy (or after importing data), check that unique indexes
will build cleanly:

```bash
npm run db:check
```

That lists duplicate emails, product ids, and variant SKUs. Fix those first —
otherwise the app fails when Mongo refuses the unique indexes.

`npm run db:start` needs Docker and does nothing if a database is already
running on the port. `npm run db:stop` stops it again, and your data survives
until the container is removed.

If you would rather not run a database locally, create a free cluster at
[MongoDB Atlas](https://www.mongodb.com/atlas) and put its connection string in
`MONGODB_URI` instead. Everything else in `.env.local` (Stripe, Cloudinary,
auth) is documented in `.env.example`.

## How stock is held

A size sells out for good the moment someone starts paying for it, not when
the payment clears. Putting a shoe in the basket holds nothing — a basket can
sit for weeks, and holding stock for one would take the last pair of a size out
of sale for everyone else. The cart page says so.

Starting checkout takes a **hold**: `stock` on the product drops immediately,
so `stock` means *available*, not what is on the shelf. Because the stock is
already gone by the time the customer reaches Stripe, a successful payment
moves no counters at all — it flips the hold to `committed`, and there is no
window for a second buyer to race through.

A hold that is never paid for has to come back:

- it expires 35 minutes after it is taken, five minutes after the Stripe
  session it belongs to;
- `checkout.session.expired` and `async_payment_failed` release it as soon as
  Stripe reports them;
- every checkout sweeps expired holds before reading stock, which is what
  actually keeps the catalog honest — nothing listens for webhooks in local
  development, and they can be missed anywhere.

The cost of this design is phantom stock: a size can look sold out for up to 35
minutes because of a checkout nobody completed. That is the deliberate trade
against overselling the last pair.

Because holding stock costs the holder nothing, two limits bound how much of it
one party can freeze: ten checkouts per hour per IP, and three open holds at a
time per buyer (account email, or IP for a guest). **These raise the cost of
inventory griefing; they do not eliminate it.** Someone with a pool of
addresses can still keep scarce sizes out of sale. Closing that properly means
requiring an account to check out, or authorising payment before the hold —
both product decisions rather than code ones.

### Stock in the admin screens

`stock` in the database is what is *available*. An admin counting boxes is
looking at what is *on the shelf*, so the admin API and pages add held units
back and the write path subtracts them again. Saving the form is therefore
safe while checkouts are in progress: without that reconciliation, releasing a
hold would add its units on top of the newly saved number and invent stock that
does not exist. The products table shows "N held in checkout" whenever the two
numbers differ.

If an admin records fewer units than are currently held, available stock goes
negative and stays there. That is a real oversell, and leaving it visible stops
further sales until the count recovers.

Holds live in the `reservations` collection, one document per checkout, keeping
`held` / `committed` / `released` and the lines whose stock was actually taken.
Nothing deletes them, so a disputed order can be traced. `app/lib/stock-hold.ts`
has the details, and `stock-hold.integration.test.ts` fires overlapping writes
at a real MongoDB to prove only one buyer can win the last pair.

## Shipping and tracking

Buyers pick a delivery on Stripe's Checkout page. The choices, their prices and
the carrier behind each one live in `SHIPPING_METHODS` in `app/lib/shipping.ts`
and nowhere else — the cart quote, the product page copy, the Stripe rates and
the carrier written onto the order are all derived from that one list.

Standard (DHL) and Express (DHL Express) are live. **DPD is defined but held
back**: it carries `offered: false`, so `OFFERED_SHIPPING_METHODS` leaves it out
and checkout never shows it. Everything behind it is finished and tested — the
tracking client, the carrier mapping, the pricing, the admin form — because the
only thing missing is the DPD business contract. Selling it is that one flag
plus the credentials below. It stays in the catalogue rather than being deleted
so any order that ever chose it still reads back correctly.

Free shipping over €100 applies to standard delivery only. The threshold is
there to nudge basket size, not to give away a next-day air upgrade, so express
and DPD keep their full rate however large the basket is.

Each rate is stamped with its method id in Stripe metadata, and fulfillment
reads that id back — never the display name, which is translated copy that will
be reworded. The order gets both the method that was sold and a prefilled
`carrier`, which an admin can still correct in the ship form if the parcel
went out another way.

Tracking then routes by carrier: `app/lib/carriers.ts` turns the free-text
carrier into either a DHL service code or DPD, and `refreshTrackingForOrder`
calls the matching client. Both clients return the same result shape, so the
six-hour refresh floor, the terminal-status rule and the admin UI stay
carrier-agnostic.

DHL needs only `DHL_API_KEY` and covers standard and express alike. DPD is
different: there is no self-service signup, so `DPD_API_URL`, `DPD_DELIS_ID`
and `DPD_PASSWORD` come from a DPD business contract. Without them DPD is
simply unconfigured — a parcel an admin ships with DPD by hand still shows its
tracking number, the admin just cannot poll its status. That is a supported
state, not a broken one, and it is reported differently from a carrier we have
no integration for at all.

The DPD client is written to DPD's documented login-then-`parcellifecycle`
shape but has never run against the live API. Expect to check
`parseDpdResponse` and `mapDpdStatus` against a real sandbox response before
switching `offered` on; `dpd.test.ts` pins the current assumptions, so a
mismatch will show up there.

**DHL production access is currently blocked** — the API request was rejected
for using a non-business email address, so `DHL_API_KEY` is unset and status
polling is dark. Everything else about an order works. See
[SHIPPING.md](SHIPPING.md) for the full picture: prices, the contracts and
credentials each carrier needs, the go-live checklists, and what to do about
that rejection.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

CI runs all of these plus the tests on every push.
