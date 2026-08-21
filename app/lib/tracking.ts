import type { Db } from "mongodb";
import { orders } from "@/app/lib/db-collections";
import {
  fetchTrackingStatus,
  isDhlConfigured,
  type TrackingResult,
  type TrackingStatusCode,
} from "@/app/lib/dhl";
import { fetchDpdTrackingStatus, isDpdConfigured } from "@/app/lib/dpd";
import { trackerForCarrier, type CarrierTracker } from "@/app/lib/carriers";

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
  | {
      ok: false;
      reason:
        | "no-tracking-number"
        | "not-configured"
        | "throttled"
        | "carrier-not-supported";
    }
  | { ok: false; reason: "not-found" | "rate-limited" | "unauthorized" | "error" };

/**
 * Whether the integration behind a carrier has its credentials.
 *
 * Separate from `isTrackableCarrier`, which only asks whether an integration
 * exists at all: a shop with a DHL contract and no DPD one still ships DPD
 * parcels, and those must report "not configured" rather than "unsupported"
 * so the admin sees a setup gap instead of a dead end.
 */
export function isTrackerConfigured(tracker: CarrierTracker): boolean {
  return tracker.kind === "dhl" ? isDhlConfigured() : isDpdConfigured();
}

/**
 * One lookup, sent to whichever carrier owns the parcel.
 *
 * Both clients return the same TrackingResult union, so everything downstream
 * — the cache write, the terminal-status rule, the admin UI — stays carrier-
 * agnostic and a third carrier is a case here rather than a second pipeline.
 */
function fetchFromCarrier(
  tracker: CarrierTracker,
  trackingNumber: string
): Promise<TrackingResult> {
  return tracker.kind === "dhl"
    ? fetchTrackingStatus(trackingNumber, tracker.service)
    : fetchDpdTrackingStatus(trackingNumber);
}

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

  // Each carrier answers to its own integration, and a parcel sent with one we
  // have none for — UPS, GLS, Hermes — has a perfectly good tracking number
  // that nobody here can look up. Asking the wrong carrier would spend budget
  // to be told "not found", which reads to an admin as though the parcel were
  // lost.
  const carrier = typeof record?.carrier === "string" ? record.carrier : null;
  const tracker = trackerForCarrier(carrier);
  if (!tracker) return { ok: false, reason: "carrier-not-supported" };

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

  if (!isTrackerConfigured(tracker)) return { ok: false, reason: "not-configured" };

  const result = await fetchFromCarrier(tracker, trackingNumber);
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

/**
 * Customer-facing wording for a status code.
 *
 * DHL also sends a description of its own, but in whichever language it feels
 * like and cached on the order from whenever it was fetched — so a German
 * reader could be shown an English line written days ago. These labels are
 * ours, in the reader's language, which is why the customer pages prefer them.
 *
 * The labels are a parameter so this module stays free of locale wiring; the
 * English defaults are what the API route and the unit tests read.
 */
export type TrackingStatusLabels = {
  preTransit: string;
  transit: string;
  delivered: string;
  failure: string;
  unknown: string;
};

const DEFAULT_TRACKING_LABELS: TrackingStatusLabels = {
  preTransit: "Label created — the carrier has not scanned it yet",
  transit: "On its way",
  delivered: "Delivered",
  failure: "Delivery problem — contact us",
  unknown: "Status unavailable",
};

export function describeTrackingStatus(
  code: TrackingStatusCode,
  labels: TrackingStatusLabels = DEFAULT_TRACKING_LABELS
): string {
  switch (code) {
    case "pre-transit":
      return labels.preTransit;
    case "transit":
      return labels.transit;
    case "delivered":
      return labels.delivered;
    case "failure":
      return labels.failure;
    default:
      return labels.unknown;
  }
}
