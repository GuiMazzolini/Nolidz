import type { Db } from "mongodb";
import { products, type CartItemDoc, type ProductDoc } from "@/app/lib/db-collections";
import {
  findVariant,
  hasVariants,
  resolveLinePrice,
  resolveLineStock,
} from "@/app/lib/variants";
import type { Product } from "@/app/product-data";

/**
 * The cart join, in one place.
 *
 * Both cart routes and the cart page need the same thing: take the stored
 * lines, fetch the products they point at, and flatten each pair into the
 * shape the cart UI renders. Keeping the three in sync by hand is what let
 * them drift, so they all call through here now.
 */

/** One stored line plus its product, flattened into what the cart renders. */
export function serializeCartProduct(
  product: ProductDoc,
  item: CartItemDoc
): Product {
  const variant = findVariant(product.variants, item.variantSku);
  return {
    id: product.id,
    name: product.name,
    price: resolveLinePrice(product, item.variantSku),
    description: product.description,
    imageUrl: product.imageUrl,
    stock: resolveLineStock(product, item.variantSku),
    quantity: item.quantity,
    ...(variant
      ? {
          variantSku: variant.sku,
          variantSize: variant.size,
          variantColor: variant.color,
        }
      : {}),
  };
}

/**
 * Resolve stored cart lines into renderable products, in stored order.
 *
 * Lines are dropped rather than shown when the product is gone from the
 * catalog, or when it sells by size and the line's variant no longer exists —
 * such a line can no longer be priced or shipped, so showing it would offer
 * the shopper something that cannot be bought.
 */
export async function loadCartProducts(
  db: Db,
  items: CartItemDoc[]
): Promise<Product[]> {
  if (!items.length) return [];

  const productIds = items.map((i) => i.productId);
  const productDocs = await products(db)
    .find({ id: { $in: productIds } })
    .toArray();
  const productsById = new Map(productDocs.map((p) => [p.id, p]));

  const cartProducts: Product[] = [];
  for (const item of items) {
    const product = productsById.get(item.productId);
    if (!product) continue;
    if (hasVariants(product) && !findVariant(product.variants, item.variantSku)) {
      continue;
    }
    cartProducts.push(serializeCartProduct(product, item));
  }
  return cartProducts;
}
