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
 *
 * Server-side wording only — anything a customer reads goes through
 * `common.shippingArea` in the locale dictionaries, which must say the same
 * thing in both languages.
 */
export const SHIPPING_AREA_LABEL = "Germany";

export const FREE_SHIPPING_THRESHOLD = 100;
export const SHIPPING_FLAT_RATE = 5;

/**
 * Every delivery this shop knows about, and the only place their prices live.
 *
 * Each one names the carrier it goes out with, because the choice made at
 * checkout is what the warehouse acts on and what tracking later has to ask
 * the right carrier about. `carrier` is written onto the order verbatim and
 * read back by `carriers.ts`, so the two must stay in step — a method whose
 * carrier string nothing recognises produces an order nobody can track.
 *
 * Knowing about a method is not the same as selling it: see `offered`.
 */
export type ShippingMethodId = "standard" | "dpd" | "express";

export type ShippingMethod = {
  id: ShippingMethodId;
  /** Goes onto the order's `carrier` field; must be recognised by carriers.ts. */
  carrier: string;
  /** Full price in euros, before the free-shipping threshold is applied. */
  rate: number;
  /**
   * Whether FREE_SHIPPING_THRESHOLD zeroes this rate.
   *
   * Only standard delivery is given away. A free upgrade to next-day air costs
   * us three times the margin the threshold was meant to buy, so the promise
   * stays attached to the cheapest way we can honour it.
   */
  freeOverThreshold: boolean;
  /** Business days, for Stripe's delivery estimate. */
  deliveryDays: { min: number; max: number };
  /**
   * Whether checkout offers this to buyers right now.
   *
   * A method can be fully built and still not be for sale — DPD is held back
   * until the carrier contract is signed, because offering a delivery we
   * cannot yet book or track would sell a promise we cannot keep. Held-back
   * methods stay in this list rather than being deleted so their price and
   * carrier remain reviewable, orders that already chose them still read back
   * correctly, and going live is one field.
   */
  offered: boolean;
};

/**
 * Order matters: Stripe renders the offered ones in this order and preselects
 * the first, so standard delivery leads and the upsell sits underneath it.
 */
export const SHIPPING_METHODS: readonly ShippingMethod[] = [
  {
    id: "standard",
    carrier: "DHL",
    rate: SHIPPING_FLAT_RATE,
    freeOverThreshold: true,
    deliveryDays: { min: 2, max: 4 },
    offered: true,
  },
  {
    // Held back until the DPD business contract is in place. Everything behind
    // it is built and tested — the tracking client, the carrier mapping, the
    // admin form — so selling it is this flag plus the credentials in
    // .env.example.
    id: "dpd",
    carrier: "DPD",
    rate: 4,
    freeOverThreshold: false,
    deliveryDays: { min: 2, max: 4 },
    offered: false,
  },
  {
    id: "express",
    carrier: "DHL Express",
    rate: 15,
    freeOverThreshold: false,
    deliveryDays: { min: 1, max: 2 },
    offered: true,
  },
];

/** What checkout actually puts in front of a buyer. */
export const OFFERED_SHIPPING_METHODS: readonly ShippingMethod[] =
  SHIPPING_METHODS.filter((method) => method.offered);

export const DEFAULT_SHIPPING_METHOD: ShippingMethod = OFFERED_SHIPPING_METHODS[0];

export function isShippingMethodId(value: unknown): value is ShippingMethodId {
  return SHIPPING_METHODS.some((m) => m.id === value);
}

/**
 * Looks through every method, offered or not: an order placed while a method
 * was on sale still has to read back after it is withdrawn.
 */
export function getShippingMethod(id: string | null | undefined): ShippingMethod | null {
  return SHIPPING_METHODS.find((m) => m.id === id) ?? null;
}

/**
 * What one method costs this basket.
 *
 * The threshold is checked against the subtotal rather than the total, so
 * paying for express never pushes an order over the line into free standard
 * shipping it had not earned.
 */
export function getShippingCostFor(
  method: ShippingMethod,
  subtotal: number
): number {
  if (subtotal <= 0) return 0;
  if (method.freeOverThreshold && subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return method.rate;
}

/**
 * The standard rate, which is also the "from" price the cart quotes.
 *
 * Kept as the unqualified name because the cart cannot know what the buyer
 * will pick — the choice is made on Stripe's page, one step later — so every
 * pre-checkout total is the cheapest one we can promise.
 */
export function getShippingCost(subtotal: number): number {
  return getShippingCostFor(DEFAULT_SHIPPING_METHOD, subtotal);
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
