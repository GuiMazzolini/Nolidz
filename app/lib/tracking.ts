import type { Db } from "mongodb";
import { orders } from "@/app/lib/db-collections";
import {
  fetchTrackingStatus,
  isDhlConfigured,
  type TrackingStatusCode,
} from "@/app/lib/dhl";

/**
 * Cached DHL status on an order, and the rules for when it may be refetched.
 *
 * The whole design exists to keep a 250-request daily budget away from page
 * views. Nothing renders by calling DHL — pages read the cached fields written
 * here, and a refresh only happens when someone explicitly asks for one and
 * the floor below allows it. A crawler hitting every order page therefore
 * costs zero DHL requests.
 */

/** Minimum gap between two live lookups for the same parcel. A parcel moves a
 * handful of times a day, so anything finer spends budget to re-read the same
 * line. */
export const TRACKING_REFRESH_FLOOR_MS = 6 * 60 * 60 * 1000;

export type CachedTracking = {
  statusCode: TrackingStatusCode;
  description: string | null;
  location: string | null;
  /** DHL's timestamp for the event. */
  eventAt: Date | null;
  /** When we last got an answer — the field the floor is measured against. */
  checkedAt: Date;
};

/**
 * Terminal states. Once a parcel is delivered or has failed, DHL has nothing
 * further to report and every later lookup is wasted budget, so the refresh
 * gate treats these as permanently fresh.
 */
const TERMINAL_STATUSES: readonly TrackingStatusCode[] = ["delivered", "failure"];

export function isTerminalStatus(code: TrackingStatusCode | null): boolean {
  return code !== null && TERMINAL_STATUSES.includes(code);
}

/**
 * Whether a live lookup is allowed right now.
 *
 * Split out from the fetch so the policy is testable without a network, and
 * so callers can grey out a refresh button using the same rule the server
 * enforces.
 */
export function canRefreshTracking(
  cached: CachedTracking | null,
  now: Date = new Date()
): boolean {
  if (!cached) return true;
  if (isTerminalStatus(cached.statusCode)) return false;
  return now.getTime() - cached.checkedAt.getTime() >= TRACKING_REFRESH_FLOOR_MS;
}

export function readCachedTracking(
  doc: Record<string, unknown> | null | undefined
): CachedTracking | null {
  if (!doc) return null;
  const raw = doc.tracking;
  if (!raw || typeof raw !== "object") return null;

  const tracking = raw as Record<string, unknown>;
  const checkedAt = tracking.checkedAt;
  // Without checkedAt the floor cannot be applied, so the entry is unusable
  // as a cache and is treated as absent rather than trusted.
  if (!checkedAt) return null;

  const eventAt = tracking.eventAt ? new Date(tracking.eventAt as string | Date) : null;

  return {
    statusCode: (tracking.statusCode as TrackingStatusCode) ?? "unknown",
    description: (tracking.description as string | null) ?? null,
    location: (tracking.location as string | null) ?? null,
    eventAt: eventAt && !Number.isNaN(eventAt.getTime()) ? eventAt : null,
    checkedAt: new Date(checkedAt as string | Date),
  };
}

export type RefreshOutcome =
  | { ok: true; tracking: CachedTracking; refreshed: boolean }
  | { ok: false; reason: "no-tracking-number" | "not-configured" | "throttled" }
  | { ok: false; reason: "not-found" | "rate-limited" | "unauthorized" | "error" };

/**
 * Refresh one order's status, honouring the floor.
 *
 * Returns `refreshed: false` with the cached value when the floor blocks the
 * call — a no-op the caller can render without special-casing, because a
 * six-hour-old status is the correct thing to show.
 */
export async function refreshTrackingForOrder(
  db: Db,
  sessionId: string,
  { force = false, now = new Date() }: { force?: boolean; now?: Date } = {}
): Promise<RefreshOutcome> {
  const doc = await orders(db).findOne({ stripeSessionId: sessionId });
  const record = doc as Record<string, unknown> | null;

  const trackingNumber =
    typeof record?.trackingNumber === "string" ? record.trackingNumber.trim() : "";
  if (!trackingNumber) return { ok: false, reason: "no-tracking-number" };

  const cached = readCachedTracking(record);

  // `force` skips the time floor but never the terminal check: a delivered
  // parcel stays delivered, and letting an admin re-poll it by clicking is a
  // free way to drain the day's budget.
  const allowed = force
    ? !(cached && isTerminalStatus(cached.statusCode))
    : canRefreshTracking(cached, now);

  if (!allowed) {
    return cached
      ? { ok: true, tracking: cached, refreshed: false }
      : { ok: false, reason: "throttled" };
  }

  if (!isDhlConfigured()) return { ok: false, reason: "not-configured" };

  const result = await fetchTrackingStatus(trackingNumber);
  if (!result.ok) return { ok: false, reason: result.reason };

  const tracking: CachedTracking = {
    statusCode: result.status.statusCode,
    description: result.status.description,
    location: result.status.location,
    eventAt: result.status.timestamp,
    checkedAt: now,
  };

  await orders(db).updateOne(
    { stripeSessionId: sessionId },
    { $set: { tracking } }
  );

  return { ok: true, tracking, refreshed: true };
}

/** Customer-facing wording. DHL's own description is shown when there is one;
 * this is the fallback so a parcel is never labelled with a raw status code. */
export function describeTrackingStatus(code: TrackingStatusCode): string {
  switch (code) {
    case "pre-transit":
      return "Label created — DHL has not scanned it yet";
    case "transit":
      return "On its way";
    case "delivered":
      return "Delivered";
    case "failure":
      return "Delivery problem — contact us";
    default:
      return "Status unavailable";
  }
}
