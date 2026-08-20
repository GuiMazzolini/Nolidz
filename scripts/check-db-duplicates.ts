/**
 * Read-only scan for values that would block Mongo unique indexes from building.
 *
 *   npm run db:check
 *
 * Uses the same env as the app (.env.local). Exit code 1 when duplicates exist.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { MongoClient, ServerApiVersion } from "mongodb";
import {
  dbDuplicatesFound,
  findDbDuplicates,
  formatDbDuplicateReport,
} from "../app/lib/db-duplicates";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function getConnectionUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const user = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  const host = process.env.MONGODB_CLUSTER_HOST;

  if (!user || !password || !host) {
    throw new Error(
      "Missing MongoDB configuration. Set MONGODB_URI, or MONGODB_USER, MONGODB_PASSWORD, and MONGODB_CLUSTER_HOST in .env.local."
    );
  }

  return `mongodb+srv://${user}:${password}@${host}/?appName=Cluster0`;
}

async function main() {
  const dbName = process.env.MONGODB_DB || "nolidz";
  const client = new MongoClient(getConnectionUri(), {
    serverSelectionTimeoutMS: 5000,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
    const report = await findDbDuplicates(client.db(dbName));
    console.log(formatDbDuplicateReport(report));
    if (dbDuplicatesFound(report)) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
