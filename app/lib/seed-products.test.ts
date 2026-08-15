import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SEED_PRODUCTS } from "@/app/lib/seed-products";
import { productGallery } from "@/app/lib/images";

/**
 * The seed catalog points at photography in `public/`, and nothing else checks
 * that those files are actually there. A renamed or dropped photo would
 * otherwise reach a running catalog as a broken image.
 */

const PUBLIC = path.join(process.cwd(), "public");

/** Local paths only; a remote URL is not ours to verify. */
function localFiles(urls: string[]): string[] {
  return urls.filter((url) => url.startsWith("/"));
}

describe("seed catalog photography", () => {
  it("ships a hero image that exists for every product", () => {
    const missing = SEED_PRODUCTS.filter(
      (product) => !existsSync(path.join(PUBLIC, product.imageUrl))
    ).map((product) => `${product.id}: ${product.imageUrl}`);

    expect(missing).toEqual([]);
  });

  it("ships every colourway photo it references", () => {
    const missing: string[] = [];
    for (const product of SEED_PRODUCTS) {
      for (const entry of product.colorImages ?? []) {
        if (!existsSync(path.join(PUBLIC, entry.imageUrl))) {
          missing.push(`${product.id}/${entry.color}: ${entry.imageUrl}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("gives every product a gallery, and ships every file in it", () => {
    const withoutGallery = SEED_PRODUCTS.filter(
      (product) => !product.images?.length
    ).map((product) => product.id);
    expect(withoutGallery).toEqual([]);

    const missing: string[] = [];
    for (const product of SEED_PRODUCTS) {
      for (const src of localFiles(product.images ?? [])) {
        if (!existsSync(path.join(PUBLIC, src))) {
          missing.push(`${product.id}: ${src}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  /**
   * The gallery is extra angles, not a second copy of the hero — productGallery
   * would collapse a duplicate and quietly leave the product one photo shorter
   * than the seed claims.
   */
  it("never repeats the hero image inside a gallery", () => {
    for (const product of SEED_PRODUCTS) {
      const gallery = productGallery(product);
      expect(gallery).toHaveLength(new Set(gallery).size);
      expect(gallery.length).toBe((product.images?.length ?? 0) + 1);
    }
  });
});
