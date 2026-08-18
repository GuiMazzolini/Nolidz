/**
 * Which carrier a parcel went out with, and what we can do about it.
 *
 * The admin ship form has always accepted a free-text carrier, so orders
 * already exist with "UPS" or "CTT" on them. Tracking, meanwhile, only speaks
 * to DHL. This module is where those two facts meet: it answers "can we ask
 * anyone about this parcel, and if so, which DHL division?" so that callers
 * never have to guess from a hand-typed string.
 */

/**
 * DHL's Unified Tracking API is one endpoint across DHL's divisions, selected
 * by a `service` code. It covers only brands DHL operates — DPD, GLS, Hermes
 * and UPS are not in it at any code, so those carriers need their own
 * integration and their own contract, not a parameter change here.
 */
export type DhlService = "parcel-de" | "express";

/**
 * Free text in, a DHL service out — or null when nobody here can help.
 *
 * Matching is loose on purpose. This reads what an admin typed under time
 * pressure, so "dhl express", "DHL-Express" and "Express" all have to land on
 * the same answer, and an empty carrier falls back to parcel-de because every
 * order predating this function was a German DHL parcel.
 */
export function dhlServiceForCarrier(carrier: string | null): DhlService | null {
  const value = (carrier ?? "").trim().toLowerCase();

  // Orders shipped before the carrier field was filled in reliably.
  if (!value) return "parcel-de";

  // Express first: "dhl express" contains "dhl", so the narrower match has to
  // win or every express parcel would be looked up as a domestic one.
  if (value.includes("express")) return "express";
  if (value.includes("dhl") || value.includes("paket")) return "parcel-de";

  return null;
}

/** True when we can ask DHL about this parcel at all. */
export function isTrackableCarrier(carrier: string | null): boolean {
  return dhlServiceForCarrier(carrier) !== null;
}
