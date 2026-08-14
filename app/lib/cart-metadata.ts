/** Stripe's hard cap on the length of a single metadata value. */
export const STRIPE_METADATA_VALUE_LIMIT = 500;

/**
 * How many `cartItems*` keys a session may use. Stripe allows 50 metadata
 * keys, so this is generous by design: it covers a cart at MAX_CART_LINE_ITEMS
 * where every line carries a maximum-length product id *and* SKU (~133 chars,
 * so only three lines fit per value), which is what the schemas actually
 * permit. See the round-trip test in schemas.test.ts.
 */
export const MAX_CART_METADATA_CHUNKS = 12;

const CART_ITEMS_KEY = "cartItems";

export type CartMetadataItem = {
  productId: string;
  quantity: number;
  variantSku?: string;
};

/**
 * Comma-separated `productId:qty` pairs, or `productId|sku:qty` for a variant
 * line. Example: "runner-low|runner-low-eu42-black:2,stickers:1"
 *
 * `|` and `:` are excluded from the SKU charset (see SKU_PATTERN), so neither
 * separator can appear inside a field.
 */
export function encodeCartItemsMetadata(items: CartMetadataItem[]): string {
  return items.map(encodeItem).join(",");
}

function encodeItem(item: CartMetadataItem): string {
  const ref = item.variantSku
    ? `${item.productId}|${item.variantSku}`
    : item.productId;
  return `${ref}:${item.quantity}`;
}

export function decodeCartItemsMetadata(
  value: string | undefined | null
): CartMetadataItem[] {
  if (!value || typeof value !== "string") return [];

  return value
    .split(",")
    .map((part) => {
      const [ref, qtyRaw] = part.split(":");
      const quantity = Number(qtyRaw);
      if (!ref || !Number.isInteger(quantity) || quantity < 1) return null;

      const [productId, variantSku] = ref.split("|");
      if (!productId) return null;
      return variantSku ? { productId, quantity, variantSku } : { productId, quantity };
    })
    .filter(Boolean) as CartMetadataItem[];
}

/**
 * Split the encoded cart across `cartItems`, `cartItems2`, … so a cart of
 * long variant SKUs still fits. Returns null when even the chunk budget is
 * exceeded — fulfillment decrements stock from these values, so silently
 * dropping a line would leave inventory wrong.
 */
export function buildCartMetadata(
  items: CartMetadataItem[]
): Record<string, string> | null {
  const chunks: string[] = [];
  let current = "";

  for (const item of items) {
    const encoded = encodeItem(item);
    // A single line longer than the limit can never be packed.
    if (encoded.length > STRIPE_METADATA_VALUE_LIMIT) return null;

    const candidate = current ? `${current},${encoded}` : encoded;
    if (candidate.length > STRIPE_METADATA_VALUE_LIMIT) {
      chunks.push(current);
      current = encoded;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  if (chunks.length > MAX_CART_METADATA_CHUNKS) return null;

  const metadata: Record<string, string> = {};
  chunks.forEach((chunk, index) => {
    metadata[index === 0 ? CART_ITEMS_KEY : `${CART_ITEMS_KEY}${index + 1}`] = chunk;
  });
  return metadata;
}

/**
 * Reassemble the cart from a session's metadata. Sessions created before
 * chunking carry a single `cartItems` value and decode unchanged.
 */
export function decodeCartMetadata(
  metadata: Record<string, string> | null | undefined
): CartMetadataItem[] {
  if (!metadata) return [];

  const parts: string[] = [];
  for (let index = 0; index < MAX_CART_METADATA_CHUNKS; index++) {
    const value = metadata[index === 0 ? CART_ITEMS_KEY : `${CART_ITEMS_KEY}${index + 1}`];
    if (!value) break;
    parts.push(value);
  }

  return decodeCartItemsMetadata(parts.join(","));
}
