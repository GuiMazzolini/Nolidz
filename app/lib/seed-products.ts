import type { Product } from '../product-data';
import {
  buildVariantSku,
  totalVariantStock,
  type ColorImage,
  type ProductVariant,
} from './variants';

/**
 * Sample catalog for the shoe shop. Every product sells by EU shoe size and
 * colourway, and each size/colour combination carries its own stock count.
 *
 * Size runs differ per style the way they do in a real outlet: a men's runner
 * goes to EU 46, a women's court shoe starts at 36, and half sizes appear only
 * where that style offers them.
 */

const MENS = ['40', '41', '42', '42.5', '43', '44', '45', '46'];
const WOMENS = ['36', '36.5', '37', '38', '38.5', '39', '40', '41'];
const UNISEX = ['38', '39', '40', '41', '42', '43', '44', '45'];
const KIDS = ['28', '29', '30', '31', '32', '33', '34', '35'];

/**
 * Stock counts derived from the SKU rather than Math.random, so re-seeding
 * does not reshuffle the catalog and a number someone reports can be
 * reproduced. Roughly one size in nine lands on zero, which is what makes the
 * sold-out states visible without hand-editing anything.
 */
function stockFor(sku: string): number {
  let hash = 0;
  for (const char of sku) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const value = hash % 18;
  return value < 2 ? 0 : value;
}

function variantsFor(
  productId: string,
  colors: string[],
  sizes: string[],
): ProductVariant[] {
  return colors.flatMap((color) =>
    sizes.map((size) => {
      const sku = buildVariantSku(productId, size, color);
      return { sku, size, color, stock: stockFor(sku) };
    }),
  );
}

type SeedInput = Omit<
  Product,
  'stock' | 'variants' | 'colorImages' | 'images'
> & {
  colors: string[];
  sizes: string[];
  /** One photo per colourway, in the same order as `colors`. */
  colorPhotos: string[];
};

/**
 * The extra gallery shots for a product, named uniformly by
 * scripts/fetch-gallery-photos.py so they need no per-product wiring here.
 */
const GALLERY_PER_PRODUCT = 3;
const gallery = (id: string): string[] =>
  Array.from(
    { length: GALLERY_PER_PRODUCT },
    (_, index) => `/products/gallery/${id}-g${index + 1}.jpg`,
  );

function toProduct({ colors, sizes, colorPhotos, ...rest }: SeedInput): Product {
  const variants = variantsFor(rest.id, colors, sizes);
  const colorImages: ColorImage[] = colors.map((color, index) => ({
    color,
    // Falls back to the hero image when a colourway has no photo of its own.
    imageUrl: colorPhotos[index] ?? rest.imageUrl,
  }));
  // The product-level count mirrors the variant total, as the admin API does.
  return {
    ...rest,
    variants,
    colorImages,
    images: gallery(rest.id),
    stock: totalVariantStock(variants),
  };
}

/**
 * Sneaker photography, served from `public/products`.
 *
 * Local files rather than a remote CDN: the catalog then renders offline, in
 * CI, and on a fresh clone without depending on anyone else's host staying up.
 *
 * These are stock photos of real Nike shoes, used as development placeholders.
 * A shop that does not sell Nike should not ship them — swap them for your own
 * photography from the admin product form before this goes anywhere public.
 *
 * The same warning covers the gallery shots in `public/products/gallery`, which
 * are freely-licensed photos of other makers' shoes rather than more angles on
 * the same one. They exist so the detail-page gallery has something to show;
 * see that directory's CREDITS.md for per-file licences and attribution.
 */
const PHOTO = (name: string) => `/products/${name}.jpg`;

const CATALOG: SeedInput[] = [
  {
    id: 'runner-low',
    category: 'men',
    name: 'Outlet Runner Low',
    price: 89.99,
    description:
      'Low-profile runner with a knit upper, compression-moulded foam midsole, and a flexible cut-out sole. An everyday trainer that survives a commute and a weekend.',
    imageUrl: PHOTO('runner-black'),
    colors: ['Black', 'White', 'Red'],
    colorPhotos: [PHOTO('runner-black'), PHOTO('runner-white'), PHOTO('runner-red')],
    sizes: MENS,
  },
  {
    id: 'court-classic',
    category: 'women',
    name: 'Court Classic Leather',
    price: 74.99,
    description:
      'A clean leather court shoe with perforated toe detailing and a stitched cupsole. Creases in all the right places after a month of wear.',
    imageUrl: PHOTO('court-white'),
    colors: ['Triple White', 'Pastel', 'Green'],
    colorPhotos: [PHOTO('court-white'), PHOTO('court-blue'), PHOTO('court-green')],
    sizes: UNISEX,
  },
  {
    id: 'trail-gtx',
    category: 'men',
    name: 'Trail Runner GTX',
    price: 129.99,
    description:
      'Waterproof trail shoe with a lugged outsole, rock plate underfoot, and a gusseted tongue that keeps grit out on long descents.',
    imageUrl: PHOTO('trail-grey'),
    colors: ['Grey', 'Orange'],
    colorPhotos: [PHOTO('trail-grey'), PHOTO('trail-orange')],
    sizes: MENS,
  },
  {
    id: 'skate-mid',
    category: 'men',
    name: 'Skate Mid Canvas',
    price: 64.99,
    description:
      'Vulcanised mid-top with a padded collar and a herringbone grip sole. Built for board feel, worn everywhere else.',
    imageUrl: PHOTO('skate-black'),
    colors: ['Black', 'Blue', 'Red'],
    colorPhotos: [PHOTO('skate-black'), PHOTO('skate-blue'), PHOTO('skate-red')],
    sizes: UNISEX,
  },
  {
    id: 'retro-88',
    category: 'men',
    name: 'Retro 88 Trainer',
    price: 99.99,
    description:
      'A faithful reissue of the 1988 trainer: nubuck overlays, a mesh base, and a visible air unit in the heel. Cut on the original last.',
    imageUrl: PHOTO('retro-grey'),
    colors: ['Grey', 'Navy'],
    colorPhotos: [PHOTO('retro-grey'), PHOTO('retro-navy')],
    sizes: MENS,
  },
  {
    id: 'deck-slip-on',
    category: 'women',
    name: 'Deck Slip-On',
    price: 54.99,
    description:
      'Elasticated slip-on with a cushioned insole and a low-profile sole. The shoe you keep by the door.',
    imageUrl: PHOTO('slip-black'),
    colors: ['Black', 'Pink', 'Yellow'],
    colorPhotos: [PHOTO('slip-black'), PHOTO('slip-pink'), PHOTO('slip-yellow')],
    sizes: WOMENS,
  },
  {
    id: 'chunky-dad',
    category: 'men',
    name: 'Chunky Dad Sneaker',
    price: 109.99,
    description:
      'Layered mesh and suede on an oversized stacked midsole. Heavier than it looks and more comfortable than it has any right to be.',
    imageUrl: PHOTO('chunky-white'),
    colors: ['White', 'Brown'],
    colorPhotos: [PHOTO('chunky-white'), PHOTO('chunky-brown')],
    sizes: UNISEX,
  },
  {
    id: 'hiker-boot',
    category: 'men',
    name: 'All-Weather Hiker Boot',
    price: 149.99,
    description:
      'Canvas and corduroy upper with a fleece-lined collar, speed lacing, and a sole that clears mud instead of holding it.',
    imageUrl: PHOTO('boot-brown'),
    colors: ['Tan', 'Black'],
    colorPhotos: [PHOTO('boot-brown'), PHOTO('boot-black')],
    sizes: MENS,
  },
  {
    id: 'knit-runner',
    category: 'women',
    name: 'Knit Runner Lite',
    price: 79.99,
    description:
      'Sock-fit knit upper on a single-density foam sole, under 250 g in a size 42. Packs flat for travel and washes clean.',
    imageUrl: PHOTO('knit-offwhite'),
    colors: ['Off White', 'Red', 'Green'],
    colorPhotos: [PHOTO('knit-offwhite'), PHOTO('knit-red'), PHOTO('knit-green')],
    sizes: WOMENS,
  },
  {
    id: 'lo-pro-tennis',
    category: 'kids',
    name: 'Lo-Pro Tennis',
    price: 69.99,
    description:
      'A slim tennis silhouette in soft leather with a tonal heel tab and a thin rubber cupsole. Sits low and pairs with everything.',
    imageUrl: PHOTO('tennis-white'),
    colors: ['White', 'Black', 'Red'],
    colorPhotos: [PHOTO('tennis-white'), PHOTO('tennis-black'), PHOTO('tennis-red')],
    sizes: KIDS,
  },
];

export const SEED_PRODUCTS: Product[] = CATALOG.map(toProduct);
