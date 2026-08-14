import type { Product } from '../product-data';
import { buildVariantSku, totalVariantStock, type ProductVariant } from './variants';

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

type SeedInput = Omit<Product, 'stock' | 'variants'> & {
  colors: string[];
  sizes: string[];
};

function toProduct({ colors, sizes, ...rest }: SeedInput): Product {
  const variants = variantsFor(rest.id, colors, sizes);
  // The product-level count mirrors the variant total, as the admin API does.
  return { ...rest, variants, stock: totalVariantStock(variants) };
}

/**
 * Photography is still the placeholder set from the starter catalog, so the
 * images do not match the shoes yet. Replace them from the admin product form.
 */
const IMAGES = {
  runner: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006715/styleshop/products/shirt.jpg',
  court: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006711/styleshop/products/hat.jpg',
  trail: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006723/styleshop/products/apron.jpg',
  skate: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006725/styleshop/products/hoodie.png',
  retro: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006713/styleshop/products/mug.jpg',
  slip: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006731/styleshop/products/tote.png',
  chunky: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006729/styleshop/products/bottle.png',
  boot: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006733/styleshop/products/notebook.png',
  knit: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006735/styleshop/products/pins.png',
  tennis: 'https://res.cloudinary.com/djxvfermp/image/upload/v1786006727/styleshop/products/stickers.png',
};

const CATALOG: SeedInput[] = [
  {
    id: 'runner-low',
    name: 'Outlet Runner Low',
    price: 89.99,
    description:
      'Low-profile runner with a suede-and-mesh upper, compression-moulded foam midsole, and a gum rubber outsole. An everyday trainer that survives a commute and a weekend.',
    imageUrl: IMAGES.runner,
    colors: ['Core Black', 'Bone White', 'Sand'],
    sizes: MENS,
  },
  {
    id: 'court-classic',
    name: 'Court Classic Leather',
    price: 74.99,
    description:
      'A clean full-grain leather court shoe with perforated toe detailing and a stitched cupsole. Creases in all the right places after a month of wear.',
    imageUrl: IMAGES.court,
    colors: ['White / Green', 'White / Navy', 'Triple White'],
    sizes: UNISEX,
  },
  {
    id: 'trail-gtx',
    name: 'Trail Runner GTX',
    price: 129.99,
    description:
      'Waterproof trail shoe with a lugged outsole, rock plate underfoot, and a gusseted tongue that keeps grit out on long descents.',
    imageUrl: IMAGES.trail,
    colors: ['Slate / Lime', 'Black / Orange'],
    sizes: MENS,
  },
  {
    id: 'skate-mid',
    name: 'Skate Mid Canvas',
    price: 64.99,
    description:
      'Vulcanised mid-top in heavyweight canvas with a padded collar and a herringbone grip sole. Built for board feel, worn everywhere else.',
    imageUrl: IMAGES.skate,
    colors: ['Black / Gum', 'Faded Blue', 'Oxblood'],
    sizes: UNISEX,
  },
  {
    id: 'retro-88',
    name: 'Retro 88 Trainer',
    price: 99.99,
    description:
      'A faithful reissue of the 1988 trainer: nubuck overlays, a mesh base, and a visible air unit in the heel. Cut on the original last.',
    imageUrl: IMAGES.retro,
    colors: ['Grey / Red', 'Off White / Navy'],
    sizes: MENS,
  },
  {
    id: 'deck-slip-on',
    name: 'Deck Slip-On',
    price: 54.99,
    description:
      'Elasticated slip-on in washed canvas with a cushioned insole and a low-profile sole. The shoe you keep by the door.',
    imageUrl: IMAGES.slip,
    colors: ['Washed Black', 'Natural', 'Olive'],
    sizes: WOMENS,
  },
  {
    id: 'chunky-dad',
    name: 'Chunky Dad Sneaker',
    price: 109.99,
    description:
      'Layered mesh and suede on an oversized stacked midsole. Heavier than it looks and more comfortable than it has any right to be.',
    imageUrl: IMAGES.chunky,
    colors: ['White / Grey', 'Cream / Tan'],
    sizes: UNISEX,
  },
  {
    id: 'hiker-boot',
    name: 'All-Weather Hiker Boot',
    price: 149.99,
    description:
      'Ankle-height hiker in oiled leather with a padded cuff, speed lacing, and a deep-lug outsole that clears mud instead of holding it.',
    imageUrl: IMAGES.boot,
    colors: ['Dark Brown', 'Black'],
    sizes: MENS,
  },
  {
    id: 'knit-runner',
    name: 'Knit Runner Lite',
    price: 79.99,
    description:
      'Sock-fit knit upper on a single-density foam sole, under 250 g in a size 42. Packs flat for travel and washes clean.',
    imageUrl: IMAGES.knit,
    colors: ['Charcoal', 'Dusty Rose', 'Sage'],
    sizes: WOMENS,
  },
  {
    id: 'lo-pro-tennis',
    name: 'Lo-Pro Tennis',
    price: 69.99,
    description:
      'A slim tennis silhouette in soft leather with a tonal heel tab and a thin rubber cupsole. Sits low and pairs with everything.',
    imageUrl: IMAGES.tennis,
    colors: ['White', 'Black', 'Pale Blue'],
    sizes: UNISEX,
  },
];

export const SEED_PRODUCTS: Product[] = CATALOG.map(toProduct);
