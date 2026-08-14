# nolidz

A Next.js storefront: catalog, cart, Stripe Checkout, order history, and an
admin area for inventory.

Products can sell as a single SKU or by **EU size and colour**, where each
size/colour combination carries its own SKU and stock count. A cart line is
identified by product *and* variant, so two sizes of the same shoe are two
independent lines.

## Running locally

```bash
npm install
npm run dev
npm run seed     # loads the sample catalog, including a sized product
```

Configuration lives in `.env.local`; see `.env.example` for the keys.

## Tests

```bash
npm test              # everything
npm run test:coverage
npm run test:watch
```

Most of the suite runs with no external services. Route handlers execute
against an in-memory MongoDB double (`app/test/mongo-double.ts`) that applies
the query and update operators this app actually uses — `$elemMatch`, the
positional `$`, `$pull`, `$inc`, upserts, and unique-index violations — so a
filter that selects the wrong cart line fails a test instead of passing
silently.

### Integration tests

Files named `*.integration.test.ts` run against a real MongoDB, covering the
things a modelled database cannot vouch for: that the positional operator
updates the element we think it does, and that the unique index on
`users.email` fires on a racing signup.

```bash
npm run mongo:start        # reuses a server already on :27017, else starts a container
npm run test:integration
npm run mongo:stop
```

They **skip themselves** when no server is reachable, so `npm test` works
anywhere. CI provides one as a service container, so they run there for real.

Test databases are always named `nolidz_test_*` and are dropped afterwards;
teardown refuses to drop anything without that prefix. Point them elsewhere
with `TEST_MONGODB_URI`.
