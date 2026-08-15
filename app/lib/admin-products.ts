import { getAvailableStock } from "@/app/lib/cart-limits";
import type { ProductDoc } from "@/app/lib/db-collections";
import type { HeldStock } from "@/app/lib/stock-hold";
import { serializeVariants } from "@/app/lib/variants";

/**
 * Products as the admin screens see them.
 *
 * The catalog's `stock` is what is available to buy: checkouts in progress
 * have already taken theirs out of it. An admin is counting boxes, so these
 * screens add the held units back and show what is on the shelf. The write
 * path subtracts them again — see the PATCH handlers.
 */
export function serializeAdminProduct(doc: ProductDoc, held?: HeldStock) {
  const variants = serializeVariants(doc.variants);

  return {
    id: doc.id,
    name: doc.name,
    price: doc.price,
    description: doc.description,
    imageUrl: doc.imageUrl,
    stock: getAvailableStock(doc.stock) + (held?.total ?? 0),
    category: doc.category,
    variants:
      variants?.map((variant) => ({
        ...variant,
        stock: variant.stock + (held?.bySku.get(variant.sku) ?? 0),
      })) ?? [],
    colorImages: doc.colorImages ?? [],
    /** Extra gallery photos only — the main image stays in `imageUrl`. */
    images: doc.images ?? [],
    /** Surfaced so the admin can tell a slow week from a busy checkout queue. */
    heldForCheckout: held?.total ?? 0,
  };
}
