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
few tests that need a real MongoDB start a throwaway one automatically and
delete it when they finish. The first run downloads a MongoDB binary (~100 MB,
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

`NEXTAUTH_SECRET` also needs any random string — `openssl rand -base64 32`
generates one. Changing it later signs everyone out. Stripe, Cloudinary, and
the OAuth keys are optional in development; the app runs without them and only
the features that use them are unavailable.

`npm run db:start` needs Docker and does nothing if a database is already
running on the port. `npm run db:stop` stops it again, and your data survives
until the container is removed.

If you would rather not run a database locally, create a free cluster at
[MongoDB Atlas](https://www.mongodb.com/atlas) and put its connection string in
`MONGODB_URI` instead. Everything else in `.env.local` (Stripe, Cloudinary,
auth) is documented in `.env.example`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

CI runs all of these plus the tests on every push.
