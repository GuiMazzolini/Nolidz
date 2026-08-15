import { describe, expect, it } from "vitest";

import { colorwayHref, colorwayName, toColorways } from "@/app/lib/colorways";
import type { Product } from "@/app/product-data";

const runner: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe",
  imageUrl: "/runner-black.png",
  price: 89.99,
  stock: 11,
  variants: [
    { sku: "r-42-black", size: "42", color: "Black", stock: 3 },
    { sku: "r-43-black", size: "43", color: "Black", stock: 2 },
    { sku: "r-42-white", size: "42", color: "White", stock: 5 },
    { sku: "r-42-red", size: "42", color: "Red", stock: 1 },
  ],
  colorImages: [
    { color: "Black", imageUrl: "/runner-black.png" },
    { color: "White", imageUrl: "/runner-white.png" },
  ],
  images: ["/sole.png", "/detail.png"],
};

const mug: Product = {
  id: "mug",
  name: "Mug",
  description: "A mug",
  imageUrl: "/mug.png",
  price: 14.99,
  stock: 4,
};

describe("toColorways", () => {
  it("turns one shoe in three colours into three cards", () => {
    const cards = toColorways(runner);

    expect(cards.map((c) => c.color)).toEqual(["Black", "White", "Red"]);
    expect(cards.map((c) => c.key)).toEqual([
      "runner::Black",
      "runner::White",
      "runner::Red",
    ]);
  });

  it("gives each card the other colourways, never its own", () => {
    const [black, white, red] = toColorways(runner);

    expect(black.otherColors).toEqual(["White", "Red"]);
    expect(white.otherColors).toEqual(["Black", "Red"]);
    expect(red.otherColors).toEqual(["Black", "White"]);
  });

  /** A card advertising the product total would promise stock it cannot sell. */
  it("counts stock for the colourway alone", () => {
    const [black, white, red] = toColorways(runner);

    expect(black.stock).toBe(5);
    expect(white.stock).toBe(5);
    expect(red.stock).toBe(1);
  });

  it("leads with the colourway photo, then the gallery", () => {
    const [black, white] = toColorways(runner);

    expect(black.images).toEqual(["/runner-black.png", "/sole.png", "/detail.png"]);
    expect(white.images).toEqual(["/runner-white.png", "/sole.png", "/detail.png"]);
  });

  /** imageForColor falls back to the hero, and productGallery de-duplicates it. */
  it("does not repeat the hero for a colourway with no photo of its own", () => {
    const [, , red] = toColorways(runner);

    expect(red.images).toEqual(["/runner-black.png", "/sole.png", "/detail.png"]);
  });

  it("yields a single card with no colour for a single-SKU product", () => {
    const [card, ...rest] = toColorways(mug);

    expect(rest).toEqual([]);
    expect(card.color).toBeNull();
    expect(card.otherColors).toEqual([]);
    expect(card.key).toBe("mug");
    expect(card.stock).toBe(4);
    expect(card.images).toEqual(["/mug.png"]);
  });

  it("floors a negative or broken stock count to zero", () => {
    const broken: Product = {
      ...mug,
      stock: -5,
    };

    expect(toColorways(broken)[0].stock).toBe(0);
  });
});

describe("colourway labels and links", () => {
  it("opens the product page on the chosen colour", () => {
    const [black] = toColorways(runner);
    expect(colorwayHref(black)).toBe("/products/runner?color=Black");
  });

  it("encodes a colour with a space", () => {
    const [card] = toColorways({
      ...runner,
      variants: [{ sku: "r-42-ow", size: "42", color: "Off White", stock: 1 }],
    });

    expect(colorwayHref(card)).toBe("/products/runner?color=Off%20White");
  });

  it("drops the query for a product with no colourways", () => {
    expect(colorwayHref(toColorways(mug)[0])).toBe("/products/mug");
  });

  it("names a card by product and colour", () => {
    expect(colorwayName(toColorways(runner)[0])).toBe("Runner – Black");
    expect(colorwayName(toColorways(mug)[0])).toBe("Mug");
  });
});
