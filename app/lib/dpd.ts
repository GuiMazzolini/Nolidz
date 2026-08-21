/**
 * DPD Germany parcel tracking.
 *
 * Unlike DHL, DPD has no key-in-a-header public tracking API. Reaching it at
 * all needs a DPD business account: a delisId and password, which are traded
 * for a short-lived auth token by the LoginService, and that token is what the
 * tracking call carries. Both the credentials and the endpoint below come from
 * the DPD contract, which is why nothing here has a usable default —
 * `isDpdConfigured()` is false until they are set, and every caller must
 * handle that rather than assume a parcel is untrackable.
 *
 * The auth token is cached in module memory because DPD rate-limits logins far
 * harder than lookups, and re-authenticating per parcel is the quickest way to
 * get the account throttled.
 */

import type { TrackingResult, TrackingStatus, TrackingStatusCode } from "@/app/lib/dhl";

/** Ours is deliberately short; a slow carrier must never hold an admin request open. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Re-authenticate a minute before DPD would drop the token, so a lookup never
 * races the expiry it just checked.
 */
const TOKEN_SAFETY_MARGIN_MS = 60 * 1000;

export class DpdNotConfiguredError extends Error {
  constructor() {
    super("DPD_DELIS_ID / DPD_PASSWORD / DPD_API_URL are not all set");
    this.name = "DpdNotConfiguredError";
  }
}

type DpdConfig = { baseUrl: string; delisId: string; password: string };

function readConfig(): DpdConfig | null {
  const baseUrl = process.env.DPD_API_URL?.trim();
  const delisId = process.env.DPD_DELIS_ID?.trim();
  const password = process.env.DPD_PASSWORD?.trim();
  if (!baseUrl || !delisId || !password) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), delisId, password };
}

/** Absent in local dev, in tests, and in any shop without a DPD contract. */
export function isDpdConfigured(): boolean {
  return readConfig() !== null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Exported for tests, which must not inherit a token from an earlier case. */
export function resetDpdAuthCache(): void {
  cachedToken = null;
}

async function getAuthToken(config: DpdConfig): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - TOKEN_SAFETY_MARGIN_MS > now) {
    return cachedToken.token;
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        delisId: config.delisId,
        password: config.password,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const token = typeof record.authToken === "string" ? record.authToken : null;
  if (!token) return null;

  // DPD states the lifetime in seconds; a missing or unreadable one is treated
  // as a single-use token rather than cached on a guess.
  const ttlSeconds = typeof record.expires === "number" ? record.expires : 0;
  cachedToken = { token, expiresAt: now + ttlSeconds * 1000 };

  return token;
}

/**
 * DPD's own scan codes, reduced to the same five buckets DHL reports in.
 *
 * Keeping one status vocabulary across carriers is the whole point of this
 * mapping: the order page, the refresh gate and the terminal-status rule all
 * predate DPD and must not learn a second set of codes.
 */
export function mapDpdStatus(raw: unknown): TrackingStatusCode {
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  switch (code) {
    case "DELIVERED":
    case "PICKED_UP_BY_CONSIGNEE":
      return "delivered";
    case "ACCEPTED":
    case "IN_TRANSIT":
    case "AT_DELIVERY_DEPOT":
    case "OUT_FOR_DELIVERY":
      return "transit";
    case "ORDER_INFORMATION_TRANSMITTED":
    case "LABEL_CREATED":
      return "pre-transit";
    case "NOT_DELIVERED":
    case "RETURNED":
    case "REFUSED":
      return "failure";
    default:
      return "unknown";
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Pull our four fields out of DPD's parcel-lifecycle payload.
 *
 * Written defensively for the same reason dhl.ts is: this is a third-party
 * shape we do not version, and a change to it must degrade to "unknown"
 * rather than throw inside a page render.
 */
export function parseDpdResponse(body: unknown): TrackingStatus | null {
  if (!body || typeof body !== "object") return null;

  const lifecycle = (body as { parcelLifeCycleData?: unknown }).parcelLifeCycleData;
  const data =
    lifecycle && typeof lifecycle === "object"
      ? (lifecycle as Record<string, unknown>)
      : null;
  if (!data) return null;

  const statusInfo = data.statusInfo;
  if (!Array.isArray(statusInfo) || statusInfo.length === 0) return null;

  // DPD returns the whole scan history with the reached ones flagged. The last
  // reached entry is the current state; the unreached tail is DPD's forecast
  // of what should happen next, which is not something we display as fact.
  const reached = statusInfo.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry as Record<string, unknown>).statusHasBeenReached === true
  );
  const current = (reached[reached.length - 1] ?? null) as Record<string, unknown> | null;
  if (!current) return null;

  const rawTimestamp = readString(current.date);
  const timestamp = rawTimestamp ? new Date(rawTimestamp) : null;

  const label = current.label;
  const labelObj =
    label && typeof label === "object" ? (label as Record<string, unknown>) : {};

  return {
    statusCode: mapDpdStatus(current.status),
    description: readString(labelObj.content ?? current.description),
    // An unparseable date is dropped rather than stored as Invalid Date, which
    // would survive into Mongo and blow up on format.
    timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
    location: readString(current.location ?? current.depot),
  };
}

/**
 * Fetch one DPD parcel. One lookup, no retries — same reasoning as DHL: a
 * retry inside an outage spends a rate-limited budget to be told the same
 * thing twice, and a missed refresh costs nothing because the cached status
 * stays on screen.
 */
export async function fetchDpdTrackingStatus(
  trackingNumber: string
): Promise<TrackingResult> {
  const config = readConfig();
  if (!config) throw new DpdNotConfiguredError();

  const token = await getAuthToken(config);
  if (!token) return { ok: false, reason: "unauthorized" };

  const url = new URL(`${config.baseUrl}/api/parcellifecycle`);
  url.searchParams.set("parcelNo", trackingNumber);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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
    // The cached token is the likeliest culprit, and keeping it would make
    // every later lookup fail the same way until the process restarts.
    resetDpdAuthCache();
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

  const status = parseDpdResponse(body);
  // A 200 with no reached scan means DPD knows the number but has nothing to
  // say yet, which is the same practical state as a 404.
  if (!status) return { ok: false, reason: "not-found" };

  return { ok: true, status };
}
