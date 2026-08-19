import { headers } from "next/headers";
import { isOutsideShippingArea, readVisitorCountry } from "@/app/lib/shipping";
import { getT } from "@/app/i18n/server";
import ShippingAreaBannerShell from "./ShippingAreaBannerShell";

/**
 * Tells a visitor who looks to be outside the shipping area, at the door,
 * that we cannot deliver to them.
 *
 * The point is timing, not enforcement — Checkout already refuses every
 * address outside SHIPPING_COUNTRIES, and does it in a way nothing can get
 * past. What it cannot do is say so before someone has picked a size and
 * filled a basket, on a page we do not own. This does.
 *
 * Renders nothing when the host sets no geo header (local dev), so this is
 * invisible until it is deployed somewhere that resolves one.
 *
 * Mounted on the shopping routes rather than in the root layout, even though
 * the layout would cover more ground. Reading headers() there opts the whole
 * tree into dynamic rendering and costs `/` its prerender — and a Suspense
 * boundary does not buy the static shell back without PPR. These three pages
 * are already force-dynamic, so here it is free, and it still lands well
 * before anyone has invested anything in a basket.
 */
export default async function ShippingAreaBanner() {
  const country = readVisitorCountry(await headers());
  if (!isOutsideShippingArea(country)) return null;

  const t = await getT();
  return <ShippingAreaBannerShell area={t.common.shippingArea} />;
}
