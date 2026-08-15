import { guestCheckoutSchema } from "@/app/lib/schemas";
import {
  findVariant,
  hasVariants,
  resolveLineStock,
  variantLabel,
  type ProductVariant,
} from "@/app/lib/variants";

export type CartItem = {
  productId: string;
  quantity: number;
  variantSku?: string;
};

export type StockCheckedProduct = {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  stock: number;
  quantity: number;
  variantSku?: string;
  variantSize?: string;
  variantColor?: string;
};

type CatalogProduct = {
  id: string;
  name: string;
  stock?: number;
  variants?: ProductVariant[] | null;
};

/**
 * Parse guest checkout payload items. Returns null if the shape is invalid,
 * the cart is empty, or it exceeds the line-item cap.
 */
export function parseGuestCheckoutItems(body: unknown): CartItem[] | null {
  const result = guestCheckoutSchema.safeParse(body);
  return result.success ? result.data.items : null;
}

/** "Runner Low (EU 42 · Black)" — used in stock errors. */
export function describeCartLine(
  product: CatalogProduct | undefined,
  variantSku?: string
): string {
  if (!product) return "That item";
  const variant = findVariant(product.variants, variantSku);
  const label = variant ? variantLabel(variant.size, variant.color) : "";
  return label ? `${product.name} (${label})` : product.name;
}

/**
 * Validate requested quantities against stock, per size/colour combination.
 * Returns a user-facing error string, or null when the cart is stock-safe.
 */
export function getCartStockError(
  items: CartItem[],
  products: CatalogProduct[]
): string | null {
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;

    // A variant product reached with no SKU cannot be priced against a size,
    // so it is refused rather than sold from the pooled total.
    if (hasVariants(product) && !findVariant(product.variants, item.variantSku)) {
      return `Please choose a size and colour for ${product.name}`;
    }

    const stock = resolveLineStock(product, item.variantSku);
    if (item.quantity > stock) {
      const label = describeCartLine(product, item.variantSku);
      return stock < 1
        ? `${label} is out of stock`
        : `Only ${stock} of ${label} left in stock`;
    }
  }
  return null;
}

/**
 * Attach quantities to found products and skip missing product ids.
 * Call getCartStockError first (or use this after a null stock error).
 */
export function attachQuantitiesToProducts(
  items: CartItem[],
  products: (CatalogProduct & {
    price: number;
    description?: string;
    imageUrl?: string;
  })[]
): StockCheckedProduct[] {
  const result: StockCheckedProduct[] = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;

    const variant = findVariant(product.variants, item.variantSku);
    if (hasVariants(product) && !variant) continue;

    result.push({
      id: product.id,
      name: product.name,
      price: product.price,
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
    });
  }
  return result;
}
