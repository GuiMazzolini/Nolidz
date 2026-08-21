import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIPPING_METHOD,
  FREE_SHIPPING_THRESHOLD,
  OFFERED_SHIPPING_METHODS,
  SHIPPING_FLAT_RATE,
  SHIPPING_METHODS,
  getOrderTotal,
  getShippingCost,
  getShippingCostFor,
  getShippingMethod,
  isOutsideShippingArea,
  isShippingMethodId,
  readVisitorCountry,
} from "./shipping";

function headersWith(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("getShippingCost", () => {
  it("is free at and above the threshold", () => {
    expect(getShippingCost(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(getShippingCost(FREE_SHIPPING_THRESHOLD + 1)).toBe(0);
  });

  it("charges the flat rate below the threshold", () => {
    expect(getShippingCost(FREE_SHIPPING_THRESHOLD - 0.01)).toBe(
      SHIPPING_FLAT_RATE
    );
  });

  // An empty cart is not a €5 shipping bill.
  it("charges nothing on an empty or negative subtotal", () => {
    expect(getShippingCost(0)).toBe(0);
    expect(getShippingCost(-10)).toBe(0);
  });
});

describe("SHIPPING_METHODS", () => {
  // Stripe preselects the first option, and that has to be the cheap one.
  it("leads with standard delivery", () => {
    expect(OFFERED_SHIPPING_METHODS[0]).toBe(DEFAULT_SHIPPING_METHOD);
    expect(DEFAULT_SHIPPING_METHOD.id).toBe("standard");
  });

  /**
   * DPD is built but not sold: the contract is not signed, and offering a
   * delivery we cannot book or track would be a promise we cannot keep.
   */
  it("holds DPD back from what buyers are offered", () => {
    expect(getShippingMethod("dpd")?.offered).toBe(false);
    expect(OFFERED_SHIPPING_METHODS.map((m) => m.id)).toEqual([
      "standard",
      "express",
    ]);
  });

  /**
   * Withdrawing a method must never remove it from the catalogue, or an order
   * that chose it while it was on sale would stop reading back.
   */
  it("still resolves a method that is no longer offered", () => {
    expect(getShippingMethod("dpd")?.carrier).toBe("DPD");
    expect(isShippingMethodId("dpd")).toBe(true);
  });

  it("offers a subset of everything it knows about", () => {
    for (const method of OFFERED_SHIPPING_METHODS) {
      expect(SHIPPING_METHODS).toContain(method);
    }
  });

  /**
   * carriers.ts is what turns these strings back into a tracking integration.
   * A method whose carrier it cannot place would produce orders nobody can
   * track, which is invisible until a customer asks where their parcel is.
   */
  it("names a carrier for every method", () => {
    for (const method of SHIPPING_METHODS) {
      expect(method.carrier.trim()).not.toBe("");
    }
  });

  it("has no duplicate ids", () => {
    const ids = SHIPPING_METHODS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getShippingCostFor", () => {
  const express = getShippingMethod("express")!;
  const dpd = getShippingMethod("dpd")!;

  /**
   * The free-shipping promise is attached to standard delivery only. A free
   * upgrade to next-day air costs several times the margin the threshold was
   * meant to buy.
   */
  it("keeps charging for express and DPD above the threshold", () => {
    expect(getShippingCostFor(express, FREE_SHIPPING_THRESHOLD * 2)).toBe(
      express.rate
    );
    expect(getShippingCostFor(dpd, FREE_SHIPPING_THRESHOLD * 2)).toBe(dpd.rate);
  });

  it("frees standard delivery above the threshold", () => {
    expect(
      getShippingCostFor(DEFAULT_SHIPPING_METHOD, FREE_SHIPPING_THRESHOLD)
    ).toBe(0);
  });

  // An empty cart is not a shipping bill, whichever method is asked about.
  it("charges nothing on an empty or negative subtotal", () => {
    for (const method of SHIPPING_METHODS) {
      expect(getShippingCostFor(method, 0)).toBe(0);
      expect(getShippingCostFor(method, -10)).toBe(0);
    }
  });
});

describe("getShippingMethod", () => {
  it("finds a method by id and rejects anything else", () => {
    expect(getShippingMethod("express")?.id).toBe("express");
    expect(getShippingMethod("overnight-balloon")).toBeNull();
    expect(getShippingMethod(null)).toBeNull();
  });
});

describe("isShippingMethodId", () => {
  // Guards a value read back off a Stripe session, so it must reject junk.
  it("accepts only ids we offer", () => {
    expect(isShippingMethodId("standard")).toBe(true);
    expect(isShippingMethodId("dpd")).toBe(true);
    expect(isShippingMethodId("free-pony")).toBe(false);
    expect(isShippingMethodId(undefined)).toBe(false);
    expect(isShippingMethodId(7)).toBe(false);
  });
});

describe("getOrderTotal", () => {
  it("adds shipping to the subtotal", () => {
    expect(getOrderTotal(50)).toBe(50 + SHIPPING_FLAT_RATE);
    expect(getOrderTotal(FREE_SHIPPING_THRESHOLD)).toBe(FREE_SHIPPING_THRESHOLD);
  });
});

describe("readVisitorCountry", () => {
  it("reads the Vercel header", () => {
    expect(readVisitorCountry(headersWith({ "x-vercel-ip-country": "FR" }))).toBe(
      "FR"
    );
  });

  it("falls back to the Cloudflare header", () => {
    expect(readVisitorCountry(headersWith({ "cf-ipcountry": "de" }))).toBe("DE");
  });

  it("prefers Vercel when a host somehow sets both", () => {
    expect(
      readVisitorCountry(
        headersWith({ "x-vercel-ip-country": "DE", "cf-ipcountry": "US" })
      )
    ).toBe("DE");
  });

  // Local dev and any host that does not resolve geo at the edge.
  it("returns null when no header is present", () => {
    expect(readVisitorCountry(headersWith({}))).toBeNull();
  });

  // Cloudflare's own "I could not tell" values must not read as countries.
  it("returns null for unknown and Tor placeholders", () => {
    expect(readVisitorCountry(headersWith({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(readVisitorCountry(headersWith({ "cf-ipcountry": "T1" }))).toBeNull();
  });

  it("returns null for anything that is not a two-letter code", () => {
    for (const value of ["", "  ", "DEU", "D", "1E", "DE,FR"]) {
      expect(readVisitorCountry(headersWith({ "cf-ipcountry": value }))).toBeNull();
    }
  });
});

describe("isOutsideShippingArea", () => {
  it("does not warn a German visitor", () => {
    expect(isOutsideShippingArea("DE")).toBe(false);
  });

  it("warns a visitor elsewhere, including the rest of the EU", () => {
    expect(isOutsideShippingArea("AT")).toBe(true);
    expect(isOutsideShippingArea("FR")).toBe(true);
    expect(isOutsideShippingArea("US")).toBe(true);
  });

  // The whole point of the null: an unresolved country warns nobody, so a
  // missing header can never cost a real customer a scary banner.
  it("warns nobody when the country is unknown", () => {
    expect(isOutsideShippingArea(null)).toBe(false);
  });
});
