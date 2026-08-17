import { describe, expect, it } from "vitest";
import { EMPTY_ADDRESS, addressForForm } from "./address";
import type { SavedAddress } from "@/app/lib/db-collections";

const german: SavedAddress = {
  line1: "Torstraße 1",
  line2: "Hinterhaus",
  city: "Berlin",
  state: null,
  postalCode: "10119",
  country: "DE",
};

const portuguese: SavedAddress = {
  line1: "Rua Augusta 10",
  line2: null,
  city: "Lisbon",
  state: null,
  postalCode: "1100-048",
  country: "PT",
};

describe("addressForForm", () => {
  it("returns a blank address when nothing is saved", () => {
    expect(addressForForm(null)).toEqual(EMPTY_ADDRESS);
  });

  it("keeps a German address intact so editing one field does not retype the rest", () => {
    expect(addressForForm(german)).toEqual(german);
  });

  it("accepts a lowercase country code", () => {
    expect(addressForForm({ ...german, country: "de" })).toEqual(german);
  });

  /**
   * The bug this function exists for. Relabelling the country left "Lisbon /
   * 1100-048 / Germany" in the form, and saving that passed every check —
   * addressSchema validates the country code and never asks whether the
   * postcode and city agree with it.
   */
  it("drops a non-German address rather than relabelling it as German", () => {
    const result = addressForForm(portuguese);
    expect(result).toEqual(EMPTY_ADDRESS);
    expect(result.city).toBe("");
    expect(result.postalCode).toBe("");
    expect(result.line1).toBe("");
  });

  it("drops the address for any other country too", () => {
    for (const country of ["AT", "US", "FR", "CH"]) {
      expect(addressForForm({ ...portuguese, country })).toEqual(EMPTY_ADDRESS);
    }
  });

  it("drops an address with a missing or junk country", () => {
    expect(addressForForm({ ...portuguese, country: "" })).toEqual(EMPTY_ADDRESS);
    expect(
      addressForForm({ ...portuguese, country: null as unknown as string })
    ).toEqual(EMPTY_ADDRESS);
  });

  // Callers put the result straight into component state and mutate it.
  it("returns a fresh object rather than a shared constant", () => {
    const first = addressForForm(null);
    first.city = "Hamburg";
    expect(addressForForm(null).city).toBe("");
    expect(EMPTY_ADDRESS.city).toBe("");
  });
});
