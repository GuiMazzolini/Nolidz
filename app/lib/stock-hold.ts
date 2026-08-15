import { products, reservations } from "@/app/lib/db-collections";
import {
  describeLineRef,
  reservationExpiresAt,
  type ReservationLine,
} from "@/app/lib/reservations";
import type { Db } from "mongodb";

/**
 * Taking and returning stock for a checkout in progress.
 *
 * `stock` on a product means *available* stock, not what is on the shelf: it
 * drops the moment a hold is taken. That is the whole point — it means the
 * success path never has to check anything. By the time Stripe says the money
 * arrived, the stock has been ours for minutes, so committing is a status flip
 * with no counter to move and therefore no window for anyone to race through.
 */

/** Bounds the work one customer's checkout does on everyone else's behalf. */
const SWEEP_BATCH = 50;

/**
 * Take stock for one line, but only if it is there. The condition and the
 * decrement are a single document update, so this cannot be beaten by a
 * concurrent checkout the way a read followed by a write can.
 */
async function takeStock(db: Db, line: ReservationLine): Promise<boolean> {
  const result = line.variantSku
    ? await products(db).updateOne(
        {
          id: line.productId,
          variants: {
            $elemMatch: { sku: line.variantSku, stock: { $gte: line.quantity } },
          },
        },
        {
          // The variant's own count and the product-level mirror move together,
          // or the catalog total drifts away from the sizes underneath it.
          $inc: { "variants.$.stock": -line.quantity, stock: -line.quantity },
        }
      )
    : await products(db).updateOne(
        { id: line.productId, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } }
      );

  return result.modifiedCount === 1;
}

/** Unconditional: this stock was ours, so it goes back. */
async function giveStockBack(db: Db, line: ReservationLine): Promise<boolean> {
  const result = line.variantSku
    ? await products(db).updateOne(
        { id: line.productId, variants: { $elemMatch: { sku: line.variantSku } } },
        { $inc: { "variants.$.stock": line.quantity, stock: line.quantity } }
      )
    : await products(db).updateOne(
        { id: line.productId },
        { $inc: { stock: line.quantity } }
      );

  return result.modifiedCount === 1;
}

export type HoldResult =
  | { ok: true }
  /** The line that ran out. The caller names it in the error the shopper sees. */
  | { ok: false; failed: ReservationLine };

/**
 * Take stock for every line, or none of them.
 *
 * There is no transaction here: the local development database is a standalone
 * mongod, which does not support them. Instead a partial hold is rolled back by
 * releasing it, and the expiry sweep is the backstop if the process dies first.
 */
export async function holdStock(
  db: Db,
  {
    reservationId,
    lines,
    userId,
    holder,
  }: {
    reservationId: string;
    lines: ReservationLine[];
    userId?: string | null;
    /** Account email, or `ip:<addr>` for a guest. See countOpenHolds. */
    holder: string;
  }
): Promise<HoldResult> {
  await reservations(db).insertOne({
    reservationId,
    stripeSessionId: null,
    userId: userId ?? null,
    holder,
    lines,
    applied: [],
    status: "held",
    expiresAt: reservationExpiresAt(),
    createdAt: new Date(),
  });

  for (const line of lines) {
    // Decrement first, record second. A crash in between loses stock until
    // someone notices. The opposite order would hand back stock that was never
    // taken, which oversells — so this direction fails closed on purpose.
    if (!(await takeStock(db, line))) {
      await releaseHold(db, reservationId, "unavailable");
      return { ok: false, failed: line };
    }

    await reservations(db).updateOne(
      { reservationId },
      { $push: { applied: line } }
    );
  }

  return { ok: true };
}

/** Record which Stripe session a hold belongs to, for support and admin. */
export async function attachSessionToHold(
  db: Db,
  reservationId: string,
  stripeSessionId: string
): Promise<void> {
  await reservations(db).updateOne(
    { reservationId },
    { $set: { stripeSessionId } }
  );
}

/**
 * Give the stock back. Returns false when there was nothing to release, which
 * is the normal outcome for the second caller rather than an error: the
 * expiry sweep, the `checkout.session.expired` webhook, and a failed session
 * creation can all reach the same hold.
 */
export async function releaseHold(
  db: Db,
  reservationId: string,
  reason: string
): Promise<boolean> {
  // The status transition is the lock. Only whoever moves it off "held" gets
  // to return the stock, so two callers cannot return it twice.
  const doc = await reservations(db).findOneAndUpdate(
    { reservationId, status: "held" },
    {
      $set: {
        status: "released",
        releasedAt: new Date(),
        releaseReason: reason,
      },
    },
    { returnDocument: "before" }
  );

  if (!doc) return false;

  for (const line of doc.applied ?? []) {
    if (!(await giveStockBack(db, line))) {
      // The variant was edited or deleted while the checkout was open, so
      // there is no counter to credit. Log it; an admin can correct the count.
      console.warn(
        `Hold ${reservationId}: could not return ${line.quantity} of ${describeLineRef(line)}`
      );
    }
  }

  return true;
}

export type CommitResult =
  /** This call closed the hold; stock was already taken when it was made. */
  | "committed"
  /** A retry of a webhook that already closed it. Still nothing to decrement. */
  | "already-committed"
  /** Expired or released before payment landed; the caller must decrement. */
  | "gone";

/**
 * Close a hold out after payment. Deliberately moves no counters: the stock
 * left the catalog when the hold was taken.
 */
export async function commitHold(
  db: Db,
  reservationId: string
): Promise<CommitResult> {
  const doc = await reservations(db).findOneAndUpdate(
    { reservationId, status: "held" },
    { $set: { status: "committed", committedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (doc) return "committed";

  const existing = await reservations(db).findOne({ reservationId });
  return existing?.status === "committed" ? "already-committed" : "gone";
}

/**
 * How many checkouts this buyer currently has holding stock.
 *
 * Call `sweepExpiredHolds` first — the checkout route already does, before it
 * reads the catalog. Counting without sweeping would lock a buyer out over
 * checkouts that lapsed hours ago.
 */
export async function countOpenHolds(db: Db, holder: string): Promise<number> {
  return reservations(db).countDocuments({ holder, status: "held" });
}

/** Units currently held by checkouts in progress, for one product. */
export type HeldStock = {
  /** Across the whole product, mirroring the product-level counter. */
  total: number;
  /** Per variant SKU. A single-SKU product holds nothing here. */
  bySku: Map<string, number>;
};

/**
 * What open checkouts are holding, per product.
 *
 * The admin screens need this because `stock` is what is *available*, while an
 * admin counting boxes in a stockroom is looking at what is *on the shelf*.
 * Showing them available stock and writing it back verbatim would let a
 * released hold add its units on top of the new count and invent inventory.
 */
export async function heldStockFor(
  db: Db,
  productIds: string[]
): Promise<Map<string, HeldStock>> {
  const byProduct = new Map<string, HeldStock>();
  if (!productIds.length) return byProduct;

  const open = await reservations(db)
    .find({
      status: "held",
      applied: { $elemMatch: { productId: { $in: productIds } } },
    })
    .toArray();

  for (const doc of open) {
    for (const line of doc.applied ?? []) {
      if (!productIds.includes(line.productId)) continue;

      let entry = byProduct.get(line.productId);
      if (!entry) {
        entry = { total: 0, bySku: new Map() };
        byProduct.set(line.productId, entry);
      }

      entry.total += line.quantity;
      if (line.variantSku) {
        entry.bySku.set(
          line.variantSku,
          (entry.bySku.get(line.variantSku) ?? 0) + line.quantity
        );
      }
    }
  }

  return byProduct;
}

/**
 * Return stock from checkouts that were started and never paid for.
 *
 * This is what actually keeps the catalog honest. Stripe does send
 * `checkout.session.expired`, but nothing is listening for it in local
 * development and webhooks can be missed anywhere, so expiry cannot depend on
 * a delivery that may never arrive.
 */
export async function sweepExpiredHolds(
  db: Db,
  now: Date = new Date()
): Promise<number> {
  const expired = await reservations(db)
    .find({ status: "held", expiresAt: { $lt: now } })
    .limit(SWEEP_BATCH)
    .toArray();

  let released = 0;
  for (const doc of expired) {
    if (await releaseHold(db, doc.reservationId, "expired")) released++;
  }
  return released;
}
