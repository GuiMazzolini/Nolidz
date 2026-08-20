import { getAvailableStock } from "@/app/lib/cart-limits";
import type { ProductDoc } from "@/app/lib/db-collections";
import { sellableVariants } from "@/app/lib/variants";

/**
 * Whether the storefront should list or open this product.
 *
 * Fully sold-out pairs stay in the database for admin (restock / delete) but
 * are hidden from the catalog, PDP, and sitemap — outlet finds rarely come
 * back once gone.
 */
export function isSellableForPublic(
  doc: Pick<ProductDoc, "stock" | "variants">
): boolean {
  if (doc.variants?.length) {
    return sellableVariants(doc.variants) !== undefined;
  }
  return getAvailableStock(doc.stock) > 0;
}
