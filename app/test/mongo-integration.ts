import { MongoClient, type Db } from "mongodb";
import { inject } from "vitest";

/**
 * Support for tests that run against a real MongoDB instead of the in-memory
 * double in mongo-double.ts.
 *
 * The double models the operators this app uses, but it is still a model: it
 * cannot prove that `$elemMatch` + the positional `$` select the element we
 * think, or that a unique index fires on a racing insert. These tests do, and
 * they exist mainly to keep the double honest.
 *
 * Nothing needs installing to run them. With no configuration the run starts
 * one throwaway MongoDB in `global-mongo.ts` and throws it away afterwards, so
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
 * The MongoDB this run has to test against, or null if there is none — in
 * which case the caller skips rather than fails, so a machine with no network
 * on first run is not blocked.
 *
 * The server itself is started once per run by `global-mongo.ts`; this checks
 * that it is actually answering, which is what catches a `TEST_MONGODB_URI`
 * pointing at something that is not there.
 */
export async function getIntegrationMongo(): Promise<string | null> {
  const uri = inject("mongoUri");
  if (!uri) return null;
  return (await isReachable(uri)) ? uri : null;
}

export type TestDatabase = {
  db: Db;
  name: string;
  /** Empty every collection, keeping the indexes the app created. */
  clear: () => Promise<void>;
  /** Drop the database and close the client. The server outlives this. */
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
    },
  };
}
