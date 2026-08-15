import { Db, MongoClient, ServerApiVersion } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDB: Db | null = null;
let indexesEnsured = false;

/**
 * Older writes could persist `variants: []` instead of omitting the field.
 * A unique index on `variants.sku` treats that empty array as null, so two
 * such products would stop a *plain* unique index from building. The partial
 * filter already excludes them; this rewrite makes the stored shape match
 * what the write path now produces, so deploy does not depend on checking.
 */
export async function unsetEmptyProductVariants(db: Db) {
  await db.collection("products").updateMany(
    { variants: { $size: 0 } },
    { $unset: { variants: "" } }
  );
}

async function ensureIndexes(db: Db) {
  if (indexesEnsured) return;

  await unsetEmptyProductVariants(db);

  await Promise.all([
    // Prevents duplicate orders when webhook + success page fulfill the same session.
    db.collection("orders").createIndex({ stripeSessionId: 1 }, { unique: true }),
    db.collection("orders").createIndex({ userId: 1, createdAt: -1 }),

    // Registration does check-then-insert, which races. This is what actually
    // enforces one account per email.
    db.collection("users").createIndex({ email: 1 }, { unique: true }),

    db.collection("carts").createIndex({ userId: 1 }, { unique: true }),

    // Every product lookup queries by `id`, not `_id`.
    db.collection("products").createIndex({ id: 1 }, { unique: true }),

    /**
     * A SKU is the identity of a cart line, an order line, and a stock hold, so
     * two variants sharing one is a mis-shipment waiting to happen. This stops
     * two products — or two concurrent saves — from landing on the same SKU.
     *
     * It does not stop one product from repeating a SKU inside its own array:
     * a unique multikey index de-duplicates a document's keys before comparing,
     * so `["x", "x"]` in a single document passes. resolveVariants is what
     * covers that case, and product-indexes.integration.test.ts pins both halves.
     *
     * Partial on `variants.0` rather than plain unique: a single-SKU product has
     * no `variants` field at all (or, from older writes, `variants: []`), and
     * every one of those would index the same missing value and collide with
     * the next. `variants.0` exists only when the array has an element, so
     * both the missing field and the empty array stay out of the index.
     */
    db
      .collection("products")
      .createIndex(
        { "variants.sku": 1 },
        { unique: true, partialFilterExpression: { "variants.0": { $exists: true } } }
      ),

    // Rate-limit windows expire themselves.
    db
      .collection("ratelimits")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    // Fulfillment and the expiry sweep both look a hold up by this id.
    db
      .collection("reservations")
      .createIndex({ reservationId: 1 }, { unique: true }),
    // Deliberately not a TTL index: an expired hold still owns stock, and
    // deleting the document would strand it. The sweep returns it first.
    db.collection("reservations").createIndex({ status: 1, expiresAt: 1 }),
  ]);

  indexesEnsured = true;
}

function getConnectionUri(): string {
  // Prefer a full connection string when provided.
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  const user = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  const host = process.env.MONGODB_CLUSTER_HOST;

  if (!user || !password || !host) {
    throw new Error(
      "Missing MongoDB configuration. Set MONGODB_URI, or MONGODB_USER, MONGODB_PASSWORD, and MONGODB_CLUSTER_HOST."
    );
  }

  return `mongodb+srv://${user}:${password}@${host}/?appName=Cluster0`;
}

export async function connectToDB() {
  if (cachedClient && cachedDB) {
    await ensureIndexes(cachedDB);
    return { client: cachedClient, db: cachedDB };
  }

  const dbName = process.env.MONGODB_DB || "ecommerce-nextjs";
  const client = new MongoClient(getConnectionUri(), {
    // The driver defaults to 30s, which makes an unreachable database look
    // like a hung page rather than a failure. Fail fast and surface the error.
    serverSelectionTimeoutMS: 5000,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();

  cachedClient = client;
  cachedDB = client.db(dbName);

  await ensureIndexes(cachedDB);

  return { client: cachedClient, db: cachedDB };
}
