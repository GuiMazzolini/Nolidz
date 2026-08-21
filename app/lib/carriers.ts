/**
 * Which carrier a parcel went out with, and who we can ask about it.
 *
 * The admin ship form has always accepted a free-text carrier, so orders
 * already exist with "UPS" or "CTT" on them, and orders placed since buyers
 * could choose their delivery carry a carrier we wrote ourselves. This module
 * is where those meet: it turns either into a known carrier, and says which
 * tracking integration — if any — speaks to it.
 */

/**
 * A carrier we can name. Not the same as a carrier we can track: DPD is here
 * because buyers can pick it at checkout and admins can ship with it, but
 * whether it is trackable depends on credentials being configured.
 */
export type CarrierId = "dhl" | "dhl-express" | "dpd";

/**
 * Which integration answers for a carrier.
 *
 * DHL's Unified Tracking API is one endpoint across DHL's own divisions,
 * selected by a `service` code — it covers only brands DHL operates, so DPD
 * needs its own client and its own contract rather than another service code.
 */
export type CarrierTracker =
  | { kind: "dhl"; service: DhlService }
  | { kind: "dpd" };

/** The `service` values DHL's Unified Tracking API accepts. */
export type DhlService = "parcel-de" | "express";

const TRACKERS: Record<CarrierId, CarrierTracker> = {
  dhl: { kind: "dhl", service: "parcel-de" },
  "dhl-express": { kind: "dhl", service: "express" },
  dpd: { kind: "dpd" },
};

/**
 * Free text in, a known carrier out — or null when we cannot place it.
 *
 * Matching is loose on purpose. This reads what an admin typed under time
 * pressure, so "dhl express", "DHL-Express" and "Express" all have to land on
 * the same answer, and an empty carrier falls back to DHL because every order
 * predating the carrier field was a German DHL parcel.
 */
export function carrierFromText(carrier: string | null): CarrierId | null {
  const value = (carrier ?? "").trim().toLowerCase();

  // Orders shipped before the carrier field was filled in reliably.
  if (!value) return "dhl";

  // Express first: "dhl express" contains "dhl", so the narrower match has to
  // win or every express parcel would be looked up as a domestic one.
  if (value.includes("express")) return "dhl-express";
  if (value.includes("dpd")) return "dpd";
  if (value.includes("dhl") || value.includes("paket")) return "dhl";

  return null;
}

/** How to track this carrier, or null when nobody here can help. */
export function trackerForCarrier(carrier: string | null): CarrierTracker | null {
  const id = carrierFromText(carrier);
  return id ? TRACKERS[id] : null;
}

/**
 * Which DHL division to ask, or null when this is not a DHL parcel.
 *
 * Kept as its own export because DHL's client takes a service code and should
 * not have to know the wider carrier union exists.
 */
export function dhlServiceForCarrier(carrier: string | null): DhlService | null {
  const tracker = trackerForCarrier(carrier);
  return tracker?.kind === "dhl" ? tracker.service : null;
}

/**
 * True when some integration exists for this carrier.
 *
 * Deliberately ignores whether that integration is *configured* — a shop with
 * no DPD credentials still ships DPD parcels, and the ship form must accept
 * them. Whether a lookup can actually be made is settled later, by the
 * refresh path, which can say "not configured" instead of pretending the
 * carrier is unknown.
 */
export function isTrackableCarrier(carrier: string | null): boolean {
  return trackerForCarrier(carrier) !== null;
}
