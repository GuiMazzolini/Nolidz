/**
 * DHL Parcel DE Shipping v2 — create a Paket label on demand.
 *
 * Separate from Shipment Tracking (dhl.ts). Tracking needs only DHL_API_KEY;
 * this module needs the Parcel DE app credentials, a GKP user, and a 14-char
 * billing number. Labels are created only when an admin clicks — never from
 * a payment webhook.
 *
 * Express is out of scope: that is a different API (MyDHL).
 */

import { BUSINESS } from "@/app/lib/business";
import type { Order, ShippingAddress } from "@/app/lib/orders";

const REQUEST_TIMEOUT_MS = 20_000;
const TOKEN_SAFETY_MARGIN_MS = 60_000;
const PRODUCT_PAKET = "V01PAK";
const PROFILE = "STANDARD_GRUPPENPROFIL";

export class DhlShippingNotConfiguredError extends Error {
  constructor() {
    super(
      "DHL Parcel DE Shipping is not configured (client id/secret, GKP user/password, billing number)"
    );
    this.name = "DhlShippingNotConfiguredError";
  }
}

export type DhlShippingConfig = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  billingNumber: string;
  sandbox: boolean;
  defaultWeightKg: number;
};

export type CreatePaketLabelInput = {
  /** Stable reference printed on the label (min 8 chars). */
  refNo: string;
  consignee: ShippingAddress;
  /** Optional override; otherwise DHL_DEFAULT_WEIGHT_KG / 1 kg. */
  weightKg?: number;
};

export type CreatedPaketLabel = {
  trackingNumber: string;
  shipmentNo: string;
  /** Raw PDF bytes when DHL returned base64. */
  pdfBuffer: Buffer | null;
  /** Temporary DHL download URL when include=URL or b64 missing. */
  labelUrl: string | null;
};

export type CreatePaketLabelResult =
  | { ok: true; label: CreatedPaketLabel }
  | { ok: false; reason: "unauthorized"; detail?: string }
  | { ok: false; reason: "validation"; detail: string }
  | { ok: false; reason: "error"; detail: string };

type TokenCache = { token: string; expiresAt: number };
let cachedToken: TokenCache | null = null;

/** Exported for tests so cases do not share a token. */
export function resetDhlShippingAuthCache(): void {
  cachedToken = null;
}

export function readDhlShippingConfig(): DhlShippingConfig | null {
  const clientId = stripEnv(process.env.DHL_SHIPPING_CLIENT_ID);
  const clientSecret = stripEnv(process.env.DHL_SHIPPING_CLIENT_SECRET);
  const username = stripEnv(process.env.DHL_GKP_USERNAME);
  const password = stripEnv(process.env.DHL_GKP_PASSWORD);
  const billingNumber = stripEnv(process.env.DHL_BILLING_NUMBER);
  if (!clientId || !clientSecret || !username || !password || !billingNumber) {
    return null;
  }

  const weightRaw = stripEnv(process.env.DHL_DEFAULT_WEIGHT_KG);
  const parsed = weightRaw ? Number(weightRaw) : 1;
  const defaultWeightKg =
    Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const sandboxRaw = stripEnv(process.env.DHL_SHIPPING_SANDBOX)?.toLowerCase();
  // Only an explicit false/0/no turns production on; unset defaults to sandbox
  // so a misconfigured deploy cannot quietly bill live postage.
  const sandbox = !sandboxRaw || !["false", "0", "no"].includes(sandboxRaw);

  return {
    clientId,
    clientSecret,
    username,
    password,
    billingNumber,
    sandbox,
    defaultWeightKg,
  };
}

/** Trim and drop wrapping quotes that Vercel/UI paste sometimes keeps. */
function stripEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || undefined;
  }
  return trimmed;
}

export function isDhlShippingConfigured(): boolean {
  return readDhlShippingConfig() !== null;
}

/** Default parcel weight used when the admin does not override it on create. */
export function getDefaultLabelWeightKg(): number {
  return readDhlShippingConfig()?.defaultWeightKg ?? 1;
}

function authBase(sandbox: boolean): string {
  return sandbox
    ? "https://api-sandbox.dhl.com/parcel/de/account/auth/ropc/v1"
    : "https://api-eu.dhl.com/parcel/de/account/auth/ropc/v1";
}

function shippingBase(sandbox: boolean): string {
  return sandbox
    ? "https://api-sandbox.dhl.com/parcel/de/shipping/v2"
    : "https://api-eu.dhl.com/parcel/de/shipping/v2";
}

/**
 * ISO 3166-1 alpha-3 for DHL. Stripe gives alpha-2; our business card uses
 * the German country name.
 */
export function toDhlCountryCode(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (
    !value ||
    value === "de" ||
    value === "deu" ||
    value === "deutschland" ||
    value === "germany"
  ) {
    return "DEU";
  }
  if (value.length === 3) return value.toUpperCase();
  // Checkout is Germany-only; treat anything else as DEU rather than invent ISO3.
  return "DEU";
}

export function buildShipperAddress() {
  return {
    name1: BUSINESS.name,
    addressStreet: BUSINESS.street,
    postalCode: BUSINESS.postalCode,
    city: BUSINESS.city,
    country: toDhlCountryCode(BUSINESS.country),
    email: BUSINESS.email,
  };
}

export function buildConsigneeAddress(address: ShippingAddress) {
  const street = [address.line1, address.line2].filter(Boolean).join(", ");
  return {
    name1: (address.name ?? "Customer").trim() || "Customer",
    addressStreet: street || "—",
    postalCode: (address.postalCode ?? "").trim(),
    city: (address.city ?? "").trim(),
    country: toDhlCountryCode(address.country),
  };
}

export function buildCreateOrdersBody(
  config: DhlShippingConfig,
  input: CreatePaketLabelInput
): Record<string, unknown> {
  const weightKg = input.weightKg ?? config.defaultWeightKg;
  const weightG = Math.max(1, Math.round(weightKg * 1000));

  return {
    profile: PROFILE,
    shipments: [
      {
        product: PRODUCT_PAKET,
        billingNumber: config.billingNumber,
        refNo: input.refNo.slice(0, 35),
        shipper: buildShipperAddress(),
        consignee: buildConsigneeAddress(input.consignee),
        details: {
          weight: { uom: "g", value: weightG },
        },
      },
    ],
  };
}

/**
 * Pull tracking + PDF (or URL) out of a create-orders response item.
 * Written defensively: DHL's payload is not versioned against our shop.
 */
export function parseCreateOrdersResponse(body: unknown): CreatedPaketLabel | null {
  if (!body || typeof body !== "object") return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;

  const item = items[0];
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;

  const sstatus =
    record.sstatus && typeof record.sstatus === "object"
      ? (record.sstatus as Record<string, unknown>)
      : {};
  const statusCode =
    typeof sstatus.status === "number"
      ? sstatus.status
      : typeof sstatus.statusCode === "number"
        ? sstatus.statusCode
        : null;
  if (statusCode !== null && statusCode >= 400) return null;

  const shipmentNo =
    typeof record.shipmentNo === "string" && record.shipmentNo.trim()
      ? record.shipmentNo.trim()
      : null;
  if (!shipmentNo) return null;

  const label =
    record.label && typeof record.label === "object"
      ? (record.label as Record<string, unknown>)
      : {};
  const b64 = typeof label.b64 === "string" && label.b64.trim() ? label.b64.trim() : null;
  const url = typeof label.url === "string" && label.url.trim() ? label.url.trim() : null;

  return {
    trackingNumber: shipmentNo,
    shipmentNo,
    pdfBuffer: b64 ? Buffer.from(b64, "base64") : null,
    labelUrl: url,
  };
}

function validationDetail(body: unknown): string {
  if (!body || typeof body !== "object") return "DHL rejected the shipment";
  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail.trim();
  }
  if (typeof record.title === "string" && record.title.trim()) {
    return record.title.trim();
  }
  const items = record.items;
  if (Array.isArray(items) && items[0] && typeof items[0] === "object") {
    const item = items[0] as Record<string, unknown>;
    const messages = item.validationMessages;
    if (Array.isArray(messages) && messages[0] && typeof messages[0] === "object") {
      const msg = messages[0] as Record<string, unknown>;
      if (typeof msg.validationMessage === "string") return msg.validationMessage;
    }
    const sstatus =
      item.sstatus && typeof item.sstatus === "object"
        ? (item.sstatus as Record<string, unknown>)
        : {};
    if (typeof sstatus.detail === "string") return sstatus.detail;
    if (typeof sstatus.title === "string") return sstatus.title;
  }
  return "DHL rejected the shipment";
}

/**
 * Auth headers for Parcel DE Shipping.
 *
 * Sandbox: DHL documents Basic Auth (GKP/sandbox user + password) plus the
 * app API key as `dhl-api-key`. That path works even when ROPC rejects the
 * same key with "Invalid client identifier".
 *
 * Production: Bearer token from ROPC + the same API key header.
 */
function shippingRequestHeaders(
  config: DhlShippingConfig,
  bearerToken: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "dhl-api-key": config.clientId,
  };

  if (config.sandbox) {
    const basic = Buffer.from(
      `${config.username}:${config.password}`,
      "utf8"
    ).toString("base64");
    headers.Authorization = `Basic ${basic}`;
    return headers;
  }

  if (!bearerToken) {
    throw new Error("Bearer token required for production DHL shipping");
  }
  headers.Authorization = `Bearer ${bearerToken}`;
  return headers;
}

async function getAccessToken(config: DhlShippingConfig): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - TOKEN_SAFETY_MARGIN_MS > now) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "password",
    username: config.username,
    password: config.password,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  let response: Response;
  try {
    response = await fetch(`${authBase(config.sandbox)}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    cachedToken = null;
    const detail = await response.text().catch(() => "");
    console.error(
      `DHL shipping OAuth failed (${response.status}): ${detail.slice(0, 300)}`
    );
    return null;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return null;
  }

  const record = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const token = typeof record.access_token === "string" ? record.access_token : null;
  if (!token) return null;

  const ttlSeconds =
    typeof record.expires_in === "number" && record.expires_in > 0
      ? record.expires_in
      : 1800;
  cachedToken = { token, expiresAt: now + ttlSeconds * 1000 };
  return token;
}

/**
 * Create one DHL Paket label for a consignee address.
 */
export async function createPaketLabel(
  input: CreatePaketLabelInput
): Promise<CreatePaketLabelResult> {
  const config = readDhlShippingConfig();
  if (!config) throw new DhlShippingNotConfiguredError();

  let bearerToken: string | null = null;
  if (!config.sandbox) {
    bearerToken = await getAccessToken(config);
    if (!bearerToken) {
      return {
        ok: false,
        reason: "unauthorized",
        detail:
          "DHL OAuth failed (client id/secret or GKP user/password). Check Vercel Production env and redeploy.",
      };
    }
  } else {
    console.warn(
      "DHL Parcel DE Shipping is using SANDBOX hosts (DHL_SHIPPING_SANDBOX is not exactly \"false\")"
    );
  }

  const url = new URL(`${shippingBase(config.sandbox)}/orders`);
  url.searchParams.set("docFormat", "PDF");
  url.searchParams.set("printFormat", "A4");
  url.searchParams.set("includeDocs", "include");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: shippingRequestHeaders(config, bearerToken),
      body: JSON.stringify(buildCreateOrdersBody(config, input)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "network error";
    return { ok: false, reason: "error", detail };
  }

  if (response.status === 401 || response.status === 403) {
    cachedToken = null;
    return {
      ok: false,
      reason: "unauthorized",
      detail: `DHL shipping API returned HTTP ${response.status} (sandbox=${config.sandbox}).`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "error", detail: "invalid JSON from DHL" };
  }

  if (response.status === 400 || response.status === 422) {
    return { ok: false, reason: "validation", detail: validationDetail(body) };
  }

  if (!response.ok && response.status !== 207) {
    return {
      ok: false,
      reason: "error",
      detail: validationDetail(body) || `HTTP ${response.status}`,
    };
  }

  const label = parseCreateOrdersResponse(body);
  if (!label) {
    return { ok: false, reason: "validation", detail: validationDetail(body) };
  }
  if (!label.pdfBuffer && !label.labelUrl) {
    return {
      ok: false,
      reason: "error",
      detail: "DHL created the shipment but returned no label document",
    };
  }

  return { ok: true, label };
}

/** Whether this order is eligible for one-click DHL Paket labels. */
export function orderSupportsPaketLabel(
  order: Pick<Order, "shippingMethod" | "shippingAddress">
): boolean {
  return order.shippingMethod === "standard" && Boolean(order.shippingAddress);
}
