/** Where nolidz delivers. Stripe Checkout and saved addresses use this list. */
export const SHIPPING_COUNTRIES = ["DE"] as const;
export type ShippingCountry = (typeof SHIPPING_COUNTRIES)[number];

/**
 * The shipping area in words, for anything a customer reads.
 *
 * Kept next to SHIPPING_COUNTRIES so the two cannot drift: a storefront that
 * says "the EU" while Checkout accepts only DE reads as a yes to an Austrian
 * shopper right up until Stripe refuses their address, which is worse than
 * saying nothing at all.
 */
export const SHIPPING_AREA_LABEL = "Germany";

export const FREE_SHIPPING_THRESHOLD = 100;
export const SHIPPING_FLAT_RATE = 5;

export function getShippingCost(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
}

export function getOrderTotal(subtotal: number): number {
  return subtotal + getShippingCost(subtotal);
}

/**
 * Country code for the visitor, from whichever edge header the host sets.
 * Vercel and Cloudflare both resolve this before the request reaches us, so
 * there is no lookup to pay for and no third party in the request path.
 *
 * Returns null whenever the answer is not a plain country: the header is
 * absent (local dev, another host), or the edge itself could not tell —
 * Cloudflare sends "XX" for unknown and "T1" for Tor. Null means "no opinion",
 * which is the only safe default for something that shows the visitor a
 * warning.
 */
export function readVisitorCountry(headers: Headers): string | null {
  const raw =
    headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry") ?? "";
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (code === "XX" || code === "T1") return null;
  return code;
}

/**
 * Whether to warn this visitor that we cannot deliver to them.
 *
 * Deliberately one-directional: it never blocks and never gates a purchase,
 * because the address is what decides deliverability and IP is a poor proxy
 * for it. A German customer on holiday abroad, on a VPN, or behind carrier
 * CGNAT can look foreign while shipping to a perfectly valid German address —
 * so a false positive here must cost them a dismissible banner, nothing more.
 * An unknown country warns nobody.
 */
export function isOutsideShippingArea(country: string | null): boolean {
  if (!country) return false;
  return !SHIPPING_COUNTRIES.includes(country as ShippingCountry);
}
