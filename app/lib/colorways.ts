import { getAvailableStock } from "@/app/lib/cart-limits";
import { productGallery } from "@/app/lib/images";
import type { Product } from "@/app/product-data";
import {
  hasVariants,
  imageForColor,
  listColors,
  variantsForColor,
} from "@/app/lib/variants";

/**
 * One catalog card.
 *
 * A shoe sold in three colours is three cards, not one card with a colour
 * picker. Each colourway is what a shopper is actually choosing between, so it
 * gets its own tile, its own photo, and its own stock count — and a search for
 * "black" can return the black one alone rather than the whole shoe.
 *
 * A single-SKU product has no colourways and yields exactly one card, with
 * `color` null, which is how the card knows to offer an inline add button
 * instead of sending the shopper off to pick a size.
 */
export type Colorway = {
  /** Stable React key. A product id alone is no longer unique in the grid. */
  key: string;
  product: Product;
  color: string | null;
  /** This colourway's photo first, then the product's gallery shots. */
  images: string[];
  /** The same shoe's other colourways, in the order the admin entered them. */
  otherColors: string[];
  /** Units available in this colourway alone, not across the product. */
  stock: number;
};

/** Every card a single product contributes to the grid. */
export function toColorways(product: Product): Colorway[] {
  if (!hasVariants(product)) {
    return [
      {
        key: product.id,
        product,
        color: null,
        images: productGallery(product),
        otherColors: [],
        stock: getAvailableStock(product.stock),
      },
    ];
  }

  const variants = product.variants ?? [];
  const colors = listColors(variants);

  return colors.map((color) => ({
    key: colorwayKey(product.id, color),
    product,
    color,
    // The colourway photo leads because it is the thing being chosen; the
    // gallery shots are of the shoe as a whole and follow it.
    images: productGallery({
      imageUrl: imageForColor(product, color),
      images: product.images,
    }),
    otherColors: colors.filter((other) => other !== color),
    stock: colorwayStock(product, color),
  }));
}

/**
 * Units available in one colourway, or across a product with no colourways.
 *
 * Also used while a card is previewing a sibling colour, so the count it shows
 * belongs to the photo it is showing.
 */
export function colorwayStock(product: Product, color: string | null): number {
  if (!color) return getAvailableStock(product.stock);
  return variantsForColor(product.variants ?? [], color).reduce(
    (total, variant) => total + getAvailableStock(variant.stock),
    0
  );
}

export function colorwayKey(productId: string, color: string | null): string {
  return color ? `${productId}::${color}` : productId;
}

/** The product page for a colourway, opened on that colour. */
export function colorwayHref(colorway: Colorway): string {
  const { product, color } = colorway;
  return color
    ? `/products/${product.id}?color=${encodeURIComponent(color)}`
    : `/products/${product.id}`;
}

/** "Runner – Black", or just the name when there are no colourways. */
export function colorwayName(colorway: Colorway): string {
  return colorway.color
    ? `${colorway.product.name} – ${colorway.color}`
    : colorway.product.name;
}

/**
 * Lay colourways into a grid so two of the same shoe are not neighbours
 * while another product still has a tile to show.
 *
 * A first pass takes one colour of each product, in `compare` order. That is
 * how a first row of four becomes four shoes rather than four photos of one.
 * Leftover colours fill later passes, still in admin entry order inside each
 * shoe. When only one product remains, its colours sit together — there is
 * nothing left to put between them.
 */
export function spreadColorways(
  colorways: Colorway[],
  compare: (a: Colorway, b: Colorway) => number
): Colorway[] {
  if (colorways.length < 2) return colorways;

  const groups = new Map<string, Colorway[]>();
  for (const colorway of colorways) {
    const id = colorway.product.id;
    const group = groups.get(id);
    if (group) group.push(colorway);
    else groups.set(id, [colorway]);
  }

  const queues = [...groups.values()].sort((a, b) => compare(a[0], b[0]));
  const nextIndex = queues.map(() => 0);
  const out: Colorway[] = [];

  while (out.length < colorways.length) {
    let placed = false;
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i];
      const index = nextIndex[i];
      if (index < queue.length) {
        out.push(queue[index]);
        nextIndex[i] = index + 1;
        placed = true;
      }
    }
    if (!placed) break;
  }

  return out;
}
