/**
 * Product variants: one sellable combination of EU size and colour, with its
 * own stock count and SKU.
 *
 * A product either has variants or it does not. A product with variants sells
 * only through them — `ProductDoc.stock` is then a server-maintained mirror of
 * the variant total, kept so catalog sorting, filters, and the "out of stock"
 * badge keep working without loading every variant. Products created before
 * this feature have no `variants` array and keep behaving exactly as before.
 */

export type ProductVariant = {
  /** Unique within the product. Stable identifier for cart and order lines. */
  sku: string;
  /** EU size as typed, e.g. "42" or "42.5". Kept as a string: half sizes. */
  size: string;
  color: string;
  stock: number;
};

/** Common EU sneaker sizes, offered as quick-add buttons in the admin form. */
export const EU_SIZES = [
  "36", "36.5", "37", "37.5", "38", "38.5", "39", "40", "40.5", "41",
  "42", "42.5", "43", "44", "44.5", "45", "46", "47", "48",
];

/** Enough for a full size run in three colourways. */
export const MAX_PRODUCT_VARIANTS = 60;

export const MAX_SKU_LENGTH = 64;

/** SKUs travel through Stripe metadata, which is why `,` `:` and `|` are out. */
export const SKU_PATTERN = /^[a-zA-Z0-9._-]+$/;

function slugifyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deterministic SKU for a size/colour combination, e.g.
 * `runner-low-eu42-5-off-white`. Deterministic so re-saving a product from the
 * admin form does not orphan the SKUs already sitting in customers' carts.
 */
export function buildVariantSku(
  productId: string,
  size: string,
  color: string
): string {
  const parts = [slugifyPart(productId), `eu${slugifyPart(size)}`, slugifyPart(color)]
    .filter(Boolean)
    .join("-");
  return parts.slice(0, MAX_SKU_LENGTH) || `variant-${Date.now()}`;
}

/** Case-insensitive identity of a combination, for duplicate detection. */
export function variantComboKey(size: string, color: string): string {
  return `${size.trim().toLowerCase()}|${color.trim().toLowerCase()}`;
}

export function hasVariants(product: {
  variants?: ProductVariant[] | null;
}): boolean {
  return Array.isArray(product.variants) && product.variants.length > 0;
}

export function findVariant(
  variants: ProductVariant[] | null | undefined,
  sku: string | null | undefined
): ProductVariant | null {
  if (!variants || !sku) return null;
  return variants.find((v) => v.sku === sku) ?? null;
}

/** Total sellable units across every variant. Negative counts read as zero. */
export function totalVariantStock(variants: ProductVariant[]): number {
  return variants.reduce(
    (sum, v) => sum + (Number.isFinite(v.stock) && v.stock > 0 ? Math.floor(v.stock) : 0),
    0
  );
}

/**
 * Stock backing one cart line.
 *
 * A variant product with no SKU on the line has nothing to sell: the line
 * predates the variants or points at a deleted combination, so it is zero
 * rather than the product total. Selling it would oversell some other size.
 */
export function resolveLineStock(
  product: { stock?: number; variants?: ProductVariant[] | null },
  variantSku?: string | null
): number {
  const normalize = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;

  if (hasVariants(product)) {
    const variant = findVariant(product.variants, variantSku);
    return variant ? normalize(variant.stock) : 0;
  }
  return normalize(product.stock);
}

/**
 * Normalize variants coming out of Mongo for the client: stock counts are
 * floored to non-negative integers, matching getAvailableStock on the
 * product-level count.
 */
export function serializeVariants(
  variants: ProductVariant[] | null | undefined
): ProductVariant[] | undefined {
  if (!Array.isArray(variants) || variants.length === 0) return undefined;
  return variants.map((variant) => ({
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    stock:
      typeof variant.stock === "number" &&
      Number.isFinite(variant.stock) &&
      variant.stock > 0
        ? Math.floor(variant.stock)
        : 0,
  }));
}

/** Human-readable variant label, e.g. "EU 42.5 · Off White". */
export function variantLabel(
  size: string | null | undefined,
  color: string | null | undefined
): string {
  const parts: string[] = [];
  if (size) parts.push(`EU ${size}`);
  if (color) parts.push(color);
  return parts.join(" · ");
}

/** Product name as it should appear on a Stripe line item and order row. */
export function lineItemName(
  name: string,
  size?: string | null,
  color?: string | null
): string {
  const label = variantLabel(size, color);
  return label ? `${name} — ${label}` : name;
}

/** Distinct colours, in the order the admin entered them. */
export function listColors(variants: ProductVariant[]): string[] {
  const seen = new Set<string>();
  const colors: string[] = [];
  for (const variant of variants) {
    const key = variant.color.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      colors.push(variant.color);
    }
  }
  return colors;
}

/** Variants of one colour, sorted by numeric EU size. */
export function variantsForColor(
  variants: ProductVariant[],
  color: string
): ProductVariant[] {
  const target = color.trim().toLowerCase();
  return variants
    .filter((v) => v.color.trim().toLowerCase() === target)
    .sort((a, b) => {
      const sizeA = Number.parseFloat(a.size);
      const sizeB = Number.parseFloat(b.size);
      if (Number.isNaN(sizeA) || Number.isNaN(sizeB)) {
        return a.size.localeCompare(b.size);
      }
      return sizeA - sizeB;
    });
}

/**
 * Identity of a cart line. Two sizes of the same shoe are two lines, so
 * everything that used to key on `productId` keys on this instead.
 */
export function cartLineKey(
  productId: string,
  variantSku?: string | null
): string {
  return variantSku ? `${productId}::${variantSku}` : productId;
}
