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
  /**
   * Price for this colourway. Absent on older documents and on sizes that
   * inherit the product's price. All sizes of one colour share a price;
   * discounts are a separate concern.
   */
  price?: number;
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

function finitePrice(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Price of one cart line.
 *
 * A colourway can cost more than its siblings. The SKU is what checkout
 * charges; missing variant prices (every product predating this field) fall
 * back to the product price so old documents keep selling.
 */
export function resolveLinePrice(
  product: { price: number; variants?: ProductVariant[] | null },
  variantSku?: string | null
): number {
  const fallback = finitePrice(product.price) ?? 0;
  if (!hasVariants(product)) return fallback;
  const variant = findVariant(product.variants, variantSku);
  return finitePrice(variant?.price) ?? fallback;
}

/**
 * Price shown for a colourway: the first sized row of that colour that
 * carries a price, otherwise the product's. Sizes of one colour share a
 * price; the admin stamps it onto every row of the run.
 */
export function colorwayPrice(
  product: { price: number; variants?: ProductVariant[] | null },
  color: string | null
): number {
  const fallback = finitePrice(product.price) ?? 0;
  if (!color) return fallback;
  const priced = variantsForColor(product.variants ?? [], color).find(
    (variant) => finitePrice(variant.price) !== undefined
  );
  return finitePrice(priced?.price) ?? fallback;
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
  return variants.map((variant) => {
    const price = finitePrice(variant.price);
    return {
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      stock:
        typeof variant.stock === "number" &&
        Number.isFinite(variant.stock) &&
        variant.stock > 0
          ? Math.floor(variant.stock)
          : 0,
      ...(price !== undefined ? { price } : {}),
    };
  });
}

/**
 * The variants a shopper can actually buy right now.
 *
 * Sold-out combinations are dropped rather than sent out with `stock: 0`: the
 * public API describes what is for sale, and a size nothing can be added to a
 * cart in is not. Note that this is an API-shaping concern only — the product
 * page still renders sold-out sizes, struck through, because a shopper wants
 * to know their size exists at all before giving up on the shoe.
 *
 * Returns undefined once the whole run has gone, matching serializeVariants:
 * a product with nothing left to offer reads as a product without variants,
 * not one advertising an empty size run.
 */
export function sellableVariants(
  variants: ProductVariant[] | null | undefined
): ProductVariant[] | undefined {
  const serialized = serializeVariants(variants);
  if (!serialized) return undefined;
  const inStock = serialized.filter((variant) => variant.stock > 0);
  return inStock.length > 0 ? inStock : undefined;
}

/**
 * A size as shown to a customer.
 *
 * The "EU" prefix belongs to numeric sizing only. Accessories are sized
 * "One size", and "EU One size" reads like a mistake.
 */
export function formatSize(size: string): string {
  return isNumericSize(size) ? `EU ${size}` : size;
}

export function isNumericSize(size: string): boolean {
  return !Number.isNaN(Number.parseFloat(size));
}

/** Human-readable variant label, e.g. "EU 42.5 · Off White". */
export function variantLabel(
  size: string | null | undefined,
  color: string | null | undefined
): string {
  const parts: string[] = [];
  if (size) parts.push(formatSize(size));
  if (color) parts.push(color);
  return parts.join(" · ");
}

/** One photo per colourway, so hovering a swatch can swap the main image. */
export type ColorImage = { color: string; imageUrl: string };

/**
 * The photo for a colourway, falling back to the product's main image when
 * that colour has none of its own.
 */
export function imageForColor(
  product: { imageUrl: string; colorImages?: ColorImage[] | null },
  color: string | null | undefined
): string {
  if (!color || !product.colorImages) return product.imageUrl;
  const target = color.trim().toLowerCase();
  const match = product.colorImages.find(
    (entry) => entry.color.trim().toLowerCase() === target
  );
  return match?.imageUrl || product.imageUrl;
}

/**
 * The sizes line above the colour swatches on a catalog card.
 *
 * Few enough sizes and the numbers themselves are the useful thing; past that
 * they stop being scannable at a glance and the count is what matters.
 */
export function sizesAvailableLabel(
  variants: ProductVariant[],
  maxListed = 3
): string | null {
  const sizes = sizesInStock(variants);
  if (sizes.length === 0) return null;
  if (sizes.length > maxListed) return "Available in several sizes";

  const numeric = sizes.every(isNumericSize);
  return numeric ? `EU ${sizes.join(", ")}` : sizes.map(formatSize).join(", ");
}

/** Distinct sizes with stock somewhere in the run, smallest first. */
export function sizesInStock(variants: ProductVariant[]): string[] {
  const sizes = [...new Set(variants.filter((v) => v.stock > 0).map((v) => v.size))];
  return sizes.sort((a, b) => {
    const left = Number.parseFloat(a);
    const right = Number.parseFloat(b);
    if (Number.isNaN(left) || Number.isNaN(right)) return a.localeCompare(b);
    return left - right;
  });
}

/**
 * Which sizes a shopper can still buy, for a catalog card: "EU 40, 42, 45".
 *
 * The sizes are listed rather than collapsed to a range, because a range hides
 * exactly what an outlet shopper is scanning for — "EU 40–45" reads as six
 * sizes when only two are left. Returns null when there is nothing useful to
 * say: everything sold out, or a product that only comes in one size, where
 * the label is noise next to the stock count already on the card.
 */
export function sizesLeftLabel(
  variants: ProductVariant[],
  // A full shoe run is eight or nine sizes; listing it whole is the point on a
  // catalog card, so the cutoff sits above that rather than at a tidy number.
  maxListed = 9
): string | null {
  const sizes = sizesInStock(variants);
  if (sizes.length === 0) return null;
  if (sizes.length === 1 && !isNumericSize(sizes[0])) return null;

  const shown = sizes.slice(0, maxListed);
  const overflow = sizes.length - shown.length;

  const numeric = shown.every(isNumericSize);
  const list = numeric
    ? `EU ${shown.join(", ")}`
    : shown.map(formatSize).join(", ");

  const noun = sizes.length === 1 ? "Size" : "Sizes";
  return `${noun} left: ${list}${overflow > 0 ? ` +${overflow}` : ""}`;
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
