import { describe, expect, it } from "vitest";
import { dhlServiceForCarrier, isTrackableCarrier } from "./carriers";

describe("dhlServiceForCarrier", () => {
  it("maps DHL's domestic parcel names to parcel-de", () => {
    for (const name of ["DHL", "dhl", " DHL Paket ", "DHL-Paket"]) {
      expect(dhlServiceForCarrier(name)).toBe("parcel-de");
    }
  });

  /**
   * "DHL Express" contains "dhl", so the narrower match has to win. Getting
   * this backwards would look up every express parcel as a domestic one and
   * report it missing.
   */
  it("maps express names to express, not parcel-de", () => {
    for (const name of ["DHL Express", "express", "DHL-EXPRESS", " Express "]) {
      expect(dhlServiceForCarrier(name)).toBe("express");
    }
  });

  // Every order predating a reliably-filled carrier field was a German parcel.
  it("treats a blank carrier as the domestic parcel service", () => {
    expect(dhlServiceForCarrier(null)).toBe("parcel-de");
    expect(dhlServiceForCarrier("")).toBe("parcel-de");
    expect(dhlServiceForCarrier("   ")).toBe("parcel-de");
  });

  /**
   * The Unified Tracking API covers DHL's own divisions only. There is no
   * service code that reaches these, so they need their own integration.
   */
  it("returns null for carriers DHL cannot be asked about", () => {
    for (const name of ["DPD", "dpd", "UPS", "FedEx", "GLS", "Hermes", "CTT", "Other"]) {
      expect(dhlServiceForCarrier(name)).toBeNull();
    }
  });
});

describe("isTrackableCarrier", () => {
  it("is true only where a DHL service exists", () => {
    expect(isTrackableCarrier("DHL")).toBe(true);
    expect(isTrackableCarrier("DHL Express")).toBe(true);
    expect(isTrackableCarrier(null)).toBe(true);
    expect(isTrackableCarrier("DPD")).toBe(false);
    expect(isTrackableCarrier("UPS")).toBe(false);
  });
});
