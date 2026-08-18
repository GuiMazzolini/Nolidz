/**
 * DHL Shipment Tracking — Unified API.
 *
 * One endpoint, one header. The Parcel DE label APIs are a different animal
 * (OAuth2 against the Authentication API, and a business contract behind it);
 * nothing here touches them, so this file needs only DHL_API_KEY.
 *
 * The daily budget is the shape of this module. Our app is approved for 250
 * requests a day, which is generous for a shop's open shipments and trivial to
 * blow through if anything calls it per page view. So this exports a single
 * low-level fetch and nothing that looks like a convenience helper — every
 * caller goes through refreshTrackingForOrder in tracking.ts, which owns the
 * cache and the refresh floor.
 */

import type { DhlService } from "@/app/lib/carriers";

const TRACKING_ENDPOINT = "https://api-eu.dhl.com/track/shipments";

/** DHL's own timeout is generous; ours is not. A slow carrier API must never
 * hold an admin request open, and a missed refresh costs nothing — the cached
 * status stays on screen and the next sweep retries. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Where a parcel is, reduced to what we display.
 *
 * DHL's own `status.statusCode` is the coarse bucket (pre-transit, transit,
 * delivered, failure, unknown); `description` is the human line customers
 * actually read. Both are kept — the code drives our own logic, the
 * description is never parsed.
 */
export type TrackingStatus = {
  statusCode: TrackingStatusCode;
  description: string | null;
  /** DHL's timestamp for the latest event, not when we fetched it. */
  timestamp: Date | null;
  location: string | null;
};

export const TRACKING_STATUS_CODES = [
  "pre-transit",
  "transit",
  "delivered",
  "failure",
  "unknown",
] as const;

export type TrackingStatusCode = (typeof TRACKING_STATUS_CODES)[number];

/**
 * Outcomes a caller must tell apart.
 *
 * `not-found` is deliberately distinct from `error`: DHL returns 404 for a
 * tracking number it has never seen, which is the normal state for the first
 * hours after a label is created and not a fault worth retrying hard or
 * showing anyone. `rate-limited` is likewise not a generic error — it means
 * back off for the day, not try again in a minute.
 */
export type TrackingResult =
  | { ok: true; status: TrackingStatus }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "rate-limited" }
  | { ok: false; reason: "unauthorized" }
  | { ok: false; reason: "error"; detail: string };

export class DhlNotConfiguredError extends Error {
  constructor() {
    super("DHL_API_KEY is not set");
    this.name = "DhlNotConfiguredError";
  }
}

/** Absent in local dev and in tests, which is why callers must handle it. */
export function isDhlConfigured(): boolean {
  return Boolean(process.env.DHL_API_KEY);
}

function normalizeStatusCode(raw: unknown): TrackingStatusCode {
  const code = typeof raw === "string" ? raw.toLowerCase() : "";
  return (TRACKING_STATUS_CODES as readonly string[]).includes(code)
    ? (code as TrackingStatusCode)
    : "unknown";
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Pull our four fields out of DHL's shipment object.
 *
 * Written defensively on purpose: this is a third-party payload we do not
 * version, and a shape change must degrade to "unknown" rather than throw
 * inside a page render.
 */
export function parseTrackingResponse(body: unknown): TrackingStatus | null {
  if (!body || typeof body !== "object") return null;
  const shipments = (body as { shipments?: unknown }).shipments;
  if (!Array.isArray(shipments) || shipments.length === 0) return null;

  const shipment = shipments[0];
  if (!shipment || typeof shipment !== "object") return null;

  const status = (shipment as { status?: unknown }).status;
  const statusObj =
    status && typeof status === "object" ? (status as Record<string, unknown>) : {};

  const rawTimestamp = readString(statusObj.timestamp);
  const timestamp = rawTimestamp ? new Date(rawTimestamp) : null;

  const location = statusObj.location;
  const address =
    location && typeof location === "object"
      ? (location as { address?: unknown }).address
      : null;
  const addressObj =
    address && typeof address === "object"
      ? (address as Record<string, unknown>)
      : {};

  return {
    statusCode: normalizeStatusCode(statusObj.statusCode),
    description: readString(statusObj.description ?? statusObj.status),
    // An unparseable date is dropped rather than stored as Invalid Date, which
    // would survive into Mongo and blow up on format.
    timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
    location: readString(addressObj.addressLocality),
  };
}

/**
 * Fetch one tracking number. One HTTP call, no retries — retrying inside a
 * 250/day budget spends tomorrow's allowance on today's outage.
 */
export async function fetchTrackingStatus(
  trackingNumber: string,
  service: DhlService
): Promise<TrackingResult> {
  const apiKey = process.env.DHL_API_KEY;
  if (!apiKey) throw new DhlNotConfiguredError();

  const url = new URL(TRACKING_ENDPOINT);
  url.searchParams.set("trackingNumber", trackingNumber);
  // Scopes the lookup to one DHL division. Without it DHL searches every
  // division and can return a same-numbered shipment from another one — and
  // an express number looked up as a domestic parcel simply is not found.
  url.searchParams.set("service", service);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "DHL-API-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "network error";
    return { ok: false, reason: "error", detail };
  }

  if (response.status === 404) return { ok: false, reason: "not-found" };
  if (response.status === 429) return { ok: false, reason: "rate-limited" };
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "unauthorized" };
  }
  if (!response.ok) {
    return { ok: false, reason: "error", detail: `HTTP ${response.status}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "error", detail: "invalid JSON" };
  }

  const status = parseTrackingResponse(body);
  // A 200 carrying no shipment means DHL knows the number but has nothing to
  // say yet, which is the same practical state as a 404.
  if (!status) return { ok: false, reason: "not-found" };

  return { ok: true, status };
}
