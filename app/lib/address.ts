import { SHIPPING_COUNTRIES, type ShippingCountry } from "@/app/lib/shipping";
import type { SavedAddress } from "@/app/lib/db-collections";

/** A blank German address, which is the only kind the form can now produce. */
export const EMPTY_ADDRESS: SavedAddress = {
  line1: "",
  line2: null,
  city: "",
  state: null,
  postalCode: "",
  country: "DE",
};

function isShippableCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return SHIPPING_COUNTRIES.includes(
    country.trim().toUpperCase() as ShippingCountry
  );
}

/**
 * Prepare a stored address for the account form.
 *
 * Accounts that saved an address before nolidz became Germany-only still hold
 * a foreign one. Stamping "DE" onto it and keeping the rest — which is what
 * this used to do — produced a form reading "Lisbon / 1000-001 / Germany",
 * and saving that passed every check we have: addressSchema validates the
 * country code and never asks whether the postcode and city agree with it.
 * The result was a plausible German address that DHL cannot deliver to, sitting
 * on the account and prefilled into Checkout.
 *
 * So a non-German address is dropped rather than relabelled. The street, city
 * and postcode go; the buyer re-enters a real address instead of inheriting a
 * foreign one under a German flag. Losing three fields they must replace
 * anyway is cheaper than one undeliverable parcel.
 *
 * Note this only narrows what the form starts with. It cannot make an address
 * deliverable — a mistyped German postcode still passes, and only a real PLZ
 * check would catch that.
 */
export function addressForForm(stored: SavedAddress | null): SavedAddress {
  if (!stored) return { ...EMPTY_ADDRESS };
  if (!isShippableCountry(stored.country)) return { ...EMPTY_ADDRESS };
  // Already German: keep it verbatim, including the casing fix, so someone
  // editing one field does not have to retype the rest.
  return { ...stored, country: "DE" };
}
