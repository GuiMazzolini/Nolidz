import { describe, expect, it } from "vitest";
import {
  carrierFromText,
  dhlServiceForCarrier,
  isTrackableCarrier,
  trackerForCarrier,
} from "./carriers";

describe("carrierFromText", () => {
  it("maps DHL's domestic parcel names to dhl", () => {
    for (const name of ["DHL", "dhl", " DHL Paket ", "DHL-Paket"]) {
      expect(carrierFromText(name)).toBe("dhl");
    }
  });

  /**
   * "DHL Express" contains "dhl", so the narrower match has to win. Getting
   * this backwards would look up every express parcel as a domestic one and
   * report it missing.
   */
  it("maps express names to dhl-express, not dhl", () => {
    for (const name of ["DHL Express", "express", "DHL-EXPRESS", " Express "]) {
      expect(carrierFromText(name)).toBe("dhl-express");
    }
  });

  it("recognises DPD in any casing", () => {
    for (const name of ["DPD", "dpd", " DPD Classic ", "dpd-paket"]) {
      expect(carrierFromText(name)).toBe("dpd");
    }
  });

  // Every order predating a reliably-filled carrier field was a German parcel.
  it("treats a blank carrier as domestic DHL", () => {
    expect(carrierFromText(null)).toBe("dhl");
    expect(carrierFromText("")).toBe("dhl");
    expect(carrierFromText("   ")).toBe("dhl");
  });

  it("returns null for carriers we have no integration for", () => {
    for (const name of ["UPS", "FedEx", "GLS", "Hermes", "CTT", "Other"]) {
      expect(carrierFromText(name)).toBeNull();
    }
  });
});

describe("trackerForCarrier", () => {
  it("routes DHL parcels to the DHL client with the right service code", () => {
    expect(trackerForCarrier("DHL")).toEqual({ kind: "dhl", service: "parcel-de" });
    expect(trackerForCarrier("DHL Express")).toEqual({
      kind: "dhl",
      service: "express",
    });
  });

  it("routes DPD parcels to the DPD client", () => {
    expect(trackerForCarrier("DPD")).toEqual({ kind: "dpd" });
  });

  it("has nothing for a carrier we cannot ask", () => {
    expect(trackerForCarrier("UPS")).toBeNull();
  });
});

describe("dhlServiceForCarrier", () => {
  it("answers only for DHL's own divisions", () => {
    expect(dhlServiceForCarrier("DHL")).toBe("parcel-de");
    expect(dhlServiceForCarrier("DHL Express")).toBe("express");
    expect(dhlServiceForCarrier(null)).toBe("parcel-de");
  });

  /**
   * DPD is trackable now, but not through DHL's Unified API at any service
   * code — sending it there would look up a DPD number against DHL's parcels.
   */
  it("returns null for DPD and for unknown carriers", () => {
    expect(dhlServiceForCarrier("DPD")).toBeNull();
    expect(dhlServiceForCarrier("UPS")).toBeNull();
  });
});

describe("isTrackableCarrier", () => {
  it("is true wherever an integration exists", () => {
    expect(isTrackableCarrier("DHL")).toBe(true);
    expect(isTrackableCarrier("DHL Express")).toBe(true);
    expect(isTrackableCarrier("DPD")).toBe(true);
    expect(isTrackableCarrier(null)).toBe(true);
  });

  /**
   * Deliberately independent of credentials: a shop with no DPD contract still
   * ships DPD parcels, and the admin must be told "not configured" rather than
   * "unsupported" — those call for different fixes.
   */
  it("does not depend on whether that integration is configured", () => {
    const previous = process.env.DPD_DELIS_ID;
    delete process.env.DPD_DELIS_ID;
    expect(isTrackableCarrier("DPD")).toBe(true);
    if (previous !== undefined) process.env.DPD_DELIS_ID = previous;
  });

  it("is false for carriers nothing here speaks to", () => {
    expect(isTrackableCarrier("UPS")).toBe(false);
    expect(isTrackableCarrier("Hermes")).toBe(false);
  });
});
