import { MongoClient, type Db } from "mongodb";

/**
 * Support for tests that run against a real MongoDB instead of the in-memory
 * double in mongo-double.ts.
 *
 * The double models the operators this app uses, but it is still a model: it
 * cannot prove that `$elemMatch` + the positional `$` select the element we
 * think, or that a unique index fires on a racing insert. These tests do, and
 * they exist mainly to keep the double honest.
 *
 * Nothing needs installing to run them. With no configuration, each test file
 * starts a throwaway MongoDB of its own and throws it away afterwards, so
 * `npm test` behaves the same on a fresh clone as it does here. Set
 * `TEST_MONGODB_URI` to point at a server you already have — CI does, so it
 * uses its service container rather than downloading anything.
 */

/**
 * Test databases carry this prefix and teardown refuses to drop anything
 * without it, so pointing TEST_MONGODB_URI at a development or production
 * server can never delete its data.
 */
const TEST_DB_PREFIX = "nolidz_test_";

/** Set when this process started its own server, so it can be stopped again. */
let memoryServer: { getUri: () => string; stop: () => Promise<boolean> } | null =
  null;

async function isReachable(uri: string): Promise<boolean> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await client.close().catch(() => {});
  }
}

/**
 * A MongoDB to test against, or null if one could not be obtained — in which
 * case the caller skips rather than fails, so a machine with no network on
 * first run is not blocked.
 *
 * Downloading the server binary happens once, on first use, and is cached in
 * node_modules for every run after.
 */
export async function getIntegrationMongo(): Promise<string | null> {
  const configured = process.env.TEST_MONGODB_URI;
  if (configured) {
    return (await isReachable(configured)) ? configured : null;
  }

  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    return memoryServer.getUri();
  } catch (err) {
    console.warn(
      "Integration tests skipped: could not start a MongoDB.",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export type TestDatabase = {
  db: Db;
  name: string;
  /** Empty every collection, keeping the indexes the app created. */
  clear: () => Promise<void>;
  /** Drop the database, close the client, and stop a server we started. */
  teardown: () => Promise<void>;
};

/**
 * Point the app's `connectToDB` at a scratch database and open a separate
 * client for seeding and assertions.
 *
 * `connectToDB` reads the environment on its first call and caches the
 * connection, so this must run before the first handler call in a file.
 */
export async function useTestDatabase(
  suite: string,
  uri: string
): Promise<TestDatabase> {
  const name = `${TEST_DB_PREFIX}${suite}`;

  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = name;

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(name);

  return {
    db,
    name,
    async clear() {
      const collections = await db.listCollections().toArray();
      await Promise.all(
        collections.map((c) => db.collection(c.name).deleteMany({}))
      );
    },
    async teardown() {
      if (!name.startsWith(TEST_DB_PREFIX)) {
        throw new Error(`Refusing to drop non-test database: ${name}`);
      }
      await db.dropDatabase().catch(() => {});
      await client.close().catch(() => {});
      await memoryServer?.stop().catch(() => {});
      memoryServer = null;
    },
  };
}
