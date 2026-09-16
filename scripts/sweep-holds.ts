/**
 * Release expired (and optionally all open) checkout stock holds.
 *
 *   npm run db:sweep-holds
 *   npm run db:sweep-holds -- --all-held   # force-release every open hold
 *
 * Uses the same env as the app (.env.local). Prints what was released.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { MongoClient, ServerApiVersion } from "mongodb";
import {
  releaseHold,
  sweepExpiredHolds,
} from "../app/lib/stock-hold";
import { reservations } from "../app/lib/db-collections";

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
  const forceAll = process.argv.includes("--all-held");
  const dbName = process.env.MONGODB_DB || "nolidz";
  const client = new MongoClient(getConnectionUri(), {
    serverSelectionTimeoutMS: 10_000,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  const db = client.db(dbName);

  const open = await reservations(db)
    .find({ status: "held" })
    .project({
      reservationId: 1,
      expiresAt: 1,
      applied: 1,
      holder: 1,
      stripeSessionId: 1,
    })
    .toArray();

  console.log(`Open holds: ${open.length}`);
  for (const doc of open) {
    const lines = (doc.applied ?? [])
      .map(
        (line: { productId: string; variantSku?: string; quantity: number }) =>
          `${line.productId}${line.variantSku ? `/${line.variantSku}` : ""}×${line.quantity}`
      )
      .join(", ");
    console.log(
      `  ${doc.reservationId} expires=${doc.expiresAt?.toISOString?.() ?? doc.expiresAt} holder=${doc.holder ?? "—"} [${lines || "no applied lines"}]`
    );
  }

  let released = 0;
  if (forceAll) {
    for (const doc of open) {
      if (await releaseHold(db, doc.reservationId, "manual-sweep")) released++;
    }
    console.log(`Force-released ${released} hold(s).`);
  } else {
    // Loop until a pass finds nothing — sweep is batched at 50.
    for (let i = 0; i < 20; i++) {
      const n = await sweepExpiredHolds(db);
      released += n;
      if (n === 0) break;
    }
    console.log(`Released ${released} expired hold(s).`);
  }

  const stillOpen = await reservations(db).countDocuments({ status: "held" });
  console.log(`Still open: ${stillOpen}`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
