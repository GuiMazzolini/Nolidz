import { getAvailableStock } from "@/app/lib/cart-limits";
import type { ProductDoc } from "@/app/lib/db-collections";
import { listColors, sellableVariants } from "@/app/lib/variants";

/**
 * Products as the public API returns them.
 *
 * Built field by field rather than spread from the document, so `_id` and
 * anything added to the collection later stay out of a response whose
 * consumers this app does not control.
 *
 * Undefined fields are dropped by JSON.stringify, which is how a single-SKU
 * product ends up with no `variants` key at all — the same shape the storefront
 * pages build.
 */
export function serializePublicProduct(doc: ProductDoc) {
  const variants = sellableVariants(doc.variants);

  return {
    id: doc.id,
    name: doc.name,
    price: doc.price,
    description: doc.description,
    imageUrl: doc.imageUrl,
    stock: getAvailableStock(doc.stock),
    variants,
    colorImages: publicColorImages(doc, variants),
  };
}

/**
 * Photography for the colourways still on sale.
 *
 * Once the sold-out sizes are filtered out, a colour can lose its last variant
 * while keeping its photo, and a consumer building swatches from these would
 * offer a colourway with no size to pick. Products without variants sell off
 * their own stock, so their photos pass through untouched.
 */
function publicColorImages(
  doc: ProductDoc,
  variants: ReturnType<typeof sellableVariants>
) {
  if (!doc.colorImages?.length || !doc.variants?.length) return doc.colorImages;

  const onSale = new Set(
    listColors(variants ?? []).map((color) => color.trim().toLowerCase())
  );
  const remaining = doc.colorImages.filter((image) =>
    onSale.has(image.color.trim().toLowerCase())
  );
  return remaining.length > 0 ? remaining : undefined;
}
