import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT_RATE,
  getOrderTotal,
  getShippingCost,
  isOutsideShippingArea,
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
