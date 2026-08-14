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
 * They skip themselves when no server is reachable, so `npm test` still runs
 * anywhere. Start one with `npm run mongo:start`.
 */

export const INTEGRATION_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017";

/**
 * Every test database carries this prefix and teardown refuses to drop
 * anything without it, so a stray URI can never delete a development or
 * production database.
 */
const TEST_DB_PREFIX = "nolidz_test_";

export function testDbName(suite: string): string {
  return `${TEST_DB_PREFIX}${suite}`;
}

/** Probe once per test file; a missing server must not hang the run. */
export async function isMongoAvailable(): Promise<boolean> {
  const client = new MongoClient(INTEGRATION_URI, {
    serverSelectionTimeoutMS: 1500,
  });
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

export type TestDatabase = {
  db: Db;
  name: string;
  /** Empty every collection, keeping the indexes the app created. */
  clear: () => Promise<void>;
  drop: () => Promise<void>;
};

/**
 * Point the app's `connectToDB` at a scratch database and open a separate
 * client for seeding and assertions.
 *
 * `connectToDB` reads the environment on first call and caches the connection,
 * so this must run before the first handler call in a file.
 */
export async function useTestDatabase(suite: string): Promise<TestDatabase> {
  const name = testDbName(suite);

  process.env.MONGODB_URI = INTEGRATION_URI;
  process.env.MONGODB_DB = name;

  const client = new MongoClient(INTEGRATION_URI, {
    serverSelectionTimeoutMS: 5000,
  });
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
    async drop() {
      if (!name.startsWith(TEST_DB_PREFIX)) {
        throw new Error(`Refusing to drop non-test database: ${name}`);
      }
      await db.dropDatabase();
      await client.close();
    },
  };
}
