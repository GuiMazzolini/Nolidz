import type { Product } from '../product-data';
import { buildVariantSku, totalVariantStock, type ProductVariant } from './variants';

/**
 * Sample catalog. Every product sells by size and colour.
 *
 * Sizing is per category: footwear runs EU 40–45, apparel runs EU 46–52 (the
 * European clothing scale), and accessories are "One size" — the size label
 * drops its "EU" prefix when it is not a number, so a mug reads
 * "One size · Matte Black" rather than "EU One size".
 */

const FOOTWEAR_SIZES = ['40', '41', '42', '43', '44', '45'];
const APPAREL_SIZES = ['46', '48', '50', '52'];
const ONE_SIZE = ['One size'];

/**
 * Stock counts derived from the SKU rather than Math.random, so re-seeding
 * does not reshuffle the catalog and the numbers on screen are reproducible
 * when someone reports a problem. Roughly one combination in nine is sold out,
 * which is what makes the sold-out states visible without hand-editing.
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

const CATALOG: SeedInput[] = [
  {
    id: 'runner-low',
    name: 'Outlet Runner Low',
    price: 89.99,
    description:
      'Low-profile outlet runner with a suede-and-mesh upper, foam midsole, and a gum outsole. Each size is a separate SKU, so what you see in stock is what ships.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006715/styleshop/products/shirt.jpg',
    colors: ['Core Black', 'Bone White', 'Sand'],
    sizes: FOOTWEAR_SIZES,
  },
  {
    id: 'hoodie',
    name: 'RoboByte Pullover Hoodie',
    price: 54.99,
    description:
      'Cozy heavyweight navy hoodie with a brushed fleece interior and our signature circuit-robot chest print. Kangaroo pocket, ribbed cuffs, and a lined hood for those late-night debugging sessions.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006725/styleshop/products/hoodie.png',
    colors: ['Navy', 'Heather Grey', 'Forest'],
    sizes: APPAREL_SIZES,
  },
  {
    id: 'shirt',
    name: 'Premium Cotton T-Shirt',
    price: 29.99,
    description:
      'Soft, pre-shrunk ring-spun cotton tee with a relaxed fit and a front mascot print. A wardrobe staple that pairs with anything.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006715/styleshop/products/shirt.jpg',
    colors: ['White', 'Black', 'Dusty Rose'],
    sizes: APPAREL_SIZES,
  },
  {
    id: 'apron',
    name: 'Kitchen Chef Apron',
    price: 19.99,
    description:
      'Durable cotton apron with front pockets and an adjustable neck strap. Keeps you clean while you cook up something great.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006723/styleshop/products/apron.jpg',
    colors: ['Charcoal', 'Olive'],
    sizes: APPAREL_SIZES,
  },
  {
    id: 'hat',
    name: 'Classic Canvas Cap',
    price: 24.99,
    description:
      'A lightweight, breathable canvas cap with an adjustable strap and embroidered mascot patch. Perfect for sunny days and outdoor meetups.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006711/styleshop/products/hat.jpg',
    colors: ['Stone', 'Black', 'Faded Blue'],
    sizes: ONE_SIZE,
  },
  {
    id: 'bottle',
    name: 'Insulated Steel Water Bottle',
    price: 27.99,
    description:
      'Matte-black double-walled stainless steel bottle that keeps drinks cold for 24 hours or hot for 12. Leak-proof lid and a laser-etched mascot logo that never fades.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006729/styleshop/products/bottle.png',
    colors: ['Matte Black', 'Brushed Steel', 'Sage'],
    sizes: ONE_SIZE,
  },
  {
    id: 'tote',
    name: 'Canvas Tote Bag',
    price: 17.99,
    description:
      'Sturdy natural-canvas tote with reinforced straps and a roomy interior. Carries your laptop, dev boards, and groceries in equal style.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006731/styleshop/products/tote.png',
    colors: ['Natural', 'Washed Black'],
    sizes: ONE_SIZE,
  },
  {
    id: 'mug',
    name: 'Ceramic Coffee Mug',
    price: 14.99,
    description:
      'A sturdy 12oz ceramic mug with a comfortable handle. Microwave- and dishwasher-safe for your daily dose of caffeine-driven development.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006713/styleshop/products/mug.jpg',
    colors: ['Matte Black', 'Cream', 'Terracotta'],
    sizes: ONE_SIZE,
  },
  {
    id: 'notebook',
    name: 'Hardcover Circuit Notebook',
    price: 15.99,
    description:
      'A5 hardcover journal with 192 dotted pages, an elastic closure, ribbon bookmark, and a deep-blue cover embossed with gold circuit foil. Ideal for sketches, schematics, and standup notes.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006733/styleshop/products/notebook.png',
    colors: ['Deep Blue', 'Oxblood'],
    sizes: ONE_SIZE,
  },
  {
    id: 'pins',
    name: 'Enamel Pin Set',
    price: 12.99,
    description:
      'A trio of hard-enamel pins — the RoboBuddy mascot, a mini circuit board, and a lightning bolt — with rubber clutch backs. Pin them to bags, jackets, or lanyards.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006735/styleshop/products/pins.png',
    colors: ['Gold Trim', 'Silver Trim'],
    sizes: ONE_SIZE,
  },
  {
    id: 'stickers',
    name: 'Die-Cut Sticker Pack (10)',
    price: 9.99,
    description:
      'Ten weatherproof, scratch-resistant vinyl stickers featuring our robot mascot in every mood plus retro circuit-board art. Perfect for laptops, water bottles, and hardware cases.',
    imageUrl:
      'https://res.cloudinary.com/djxvfermp/image/upload/v1786006727/styleshop/products/stickers.png',
    colors: ['Classic', 'Neon'],
    sizes: ONE_SIZE,
  },
];

export const SEED_PRODUCTS: Product[] = CATALOG.map(toProduct);
