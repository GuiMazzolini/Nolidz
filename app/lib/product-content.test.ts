import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";
import {
  localizeProductContent,
  localizeProductsContent,
  productContentHash,
  withLocalizedContent,
  type TranslateFn,
} from "./product-content";
import type { ProductDoc } from "./db-collections";
import { resetDeepLWarningForTests } from "./deepl";

function makeProduct(
  overrides: Partial<ProductDoc> & Pick<ProductDoc, "id" | "description">
): ProductDoc {
  return {
    name: "Runner",
    imageUrl: "/x.jpg",
    price: 100,
    stock: 2,
    ...overrides,
  };
}

describe("productContentHash", () => {
  it("changes when the description changes", () => {
    const a = productContentHash("A", ["Black"]);
    const b = productContentHash("B", ["Black"]);
    expect(a).not.toBe(b);
  });

  it("is stable for the same colours in any order", () => {
    expect(productContentHash("x", ["White", "Black"])).toBe(
      productContentHash("x", ["Black", "White"])
    );
  });

  it("changes when a colour is renamed", () => {
    expect(productContentHash("x", ["Black"])).not.toBe(
      productContentHash("x", ["Navy"])
    );
  });
});

describe("localizeProductContent", () => {
  const originalKey = process.env.DEEPL_AUTH_KEY;
  const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
  const db = {
    collection: () => ({ updateOne }),
  } as unknown as Db;

  beforeEach(() => {
    process.env.DEEPL_AUTH_KEY = "test-key";
    updateOne.mockClear();
    resetDeepLWarningForTests();
  });

  afterEach(() => {
    process.env.DEEPL_AUTH_KEY = originalKey;
  });

  it("returns English unchanged for locale en", async () => {
    const translate = vi.fn() as unknown as TranslateFn;
    const product = makeProduct({
      id: "runner",
      description: "A clean runner.",
      variants: [
        { sku: "a", size: "42", color: "Black", stock: 1 },
        { sku: "b", size: "42", color: "White", stock: 1 },
      ],
    });

    const result = await localizeProductContent(db, product, "en", translate);

    expect(result).toEqual({
      description: "A clean runner.",
      colorLabels: { Black: "Black", White: "White" },
    });
    expect(translate).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("uses a fresh cache without calling DeepL", async () => {
    const translate = vi.fn() as unknown as TranslateFn;
    const colors = ["Black", "White"];
    const description = "A clean runner.";
    const hash = productContentHash(description, colors);
    const product = makeProduct({
      id: "runner",
      description,
      variants: [
        { sku: "a", size: "42", color: "Black", stock: 1 },
        { sku: "b", size: "42", color: "White", stock: 1 },
      ],
      translations: {
        de: {
          description: "Ein klarer Runner.",
          colors: { Black: "Schwarz", White: "Weiß" },
          sourceHash: hash,
        },
      },
    });

    const result = await localizeProductContent(db, product, "de", translate);

    expect(result).toEqual({
      description: "Ein klarer Runner.",
      colorLabels: { Black: "Schwarz", White: "Weiß" },
    });
    expect(translate).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("retranslates and caches when the source hash is stale", async () => {
    const translate = vi
      .fn<TranslateFn>()
      .mockResolvedValue(["Ein klarer Runner.", "Schwarz", "Weiß"]);
    const product = makeProduct({
      id: "runner",
      description: "A clean runner.",
      variants: [
        { sku: "a", size: "42", color: "Black", stock: 1 },
        { sku: "b", size: "42", color: "White", stock: 1 },
      ],
      translations: {
        de: {
          description: "Alt",
          colors: { Black: "Alt" },
          sourceHash: "stale",
        },
      },
    });

    const result = await localizeProductContent(db, product, "de", translate);

    expect(result).toEqual({
      description: "Ein klarer Runner.",
      colorLabels: { Black: "Schwarz", White: "Weiß" },
    });
    expect(translate).toHaveBeenCalledWith(
      ["A clean runner.", "Black", "White"],
      "DE"
    );
    expect(updateOne).toHaveBeenCalledOnce();
    const [, update] = updateOne.mock.calls[0];
    expect(update.$set["translations.de"].sourceHash).toBe(
      productContentHash("A clean runner.", ["Black", "White"])
    );
  });

  it("falls back to English without caching when DeepL fails", async () => {
    const translate = vi
      .fn<TranslateFn>()
      .mockRejectedValue(new Error("boom"));
    const product = makeProduct({
      id: "runner",
      description: "A clean runner.",
      variants: [{ sku: "a", size: "42", color: "Black", stock: 1 }],
    });

    const result = await localizeProductContent(db, product, "de", translate);

    expect(result.description).toBe("A clean runner.");
    expect(result.colorLabels).toEqual({ Black: "Black" });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("skips DeepL and cache writes when the API key is missing", async () => {
    delete process.env.DEEPL_AUTH_KEY;
    const translate = vi.fn() as unknown as TranslateFn;
    const product = makeProduct({
      id: "runner",
      description: "A clean runner.",
      variants: [{ sku: "a", size: "42", color: "Black", stock: 1 }],
    });

    const result = await localizeProductContent(db, product, "de", translate);

    expect(result).toEqual({
      description: "A clean runner.",
      colorLabels: { Black: "Black" },
    });
    expect(translate).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe("localizeProductsContent", () => {
  const originalKey = process.env.DEEPL_AUTH_KEY;
  const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
  const db = {
    collection: () => ({ updateOne }),
  } as unknown as Db;

  beforeEach(() => {
    process.env.DEEPL_AUTH_KEY = "test-key";
    updateOne.mockClear();
  });

  afterEach(() => {
    process.env.DEEPL_AUTH_KEY = originalKey;
  });

  it("batches cache misses into one translate call", async () => {
    const translate = vi
      .fn<TranslateFn>()
      .mockResolvedValue([
        "Beschreibung eins",
        "Schwarz",
        "Beschreibung zwei",
        "Weiß",
      ]);

    const products = [
      makeProduct({
        id: "a",
        description: "One",
        variants: [{ sku: "a1", size: "40", color: "Black", stock: 1 }],
      }),
      makeProduct({
        id: "b",
        description: "Two",
        variants: [{ sku: "b1", size: "40", color: "White", stock: 1 }],
      }),
    ];

    const map = await localizeProductsContent(db, products, "de", translate);

    expect(translate).toHaveBeenCalledOnce();
    expect(translate).toHaveBeenCalledWith(
      ["One", "Black", "Two", "White"],
      "DE"
    );
    expect(map.get("a")).toEqual({
      description: "Beschreibung eins",
      colorLabels: { Black: "Schwarz" },
    });
    expect(map.get("b")).toEqual({
      description: "Beschreibung zwei",
      colorLabels: { White: "Weiß" },
    });
    expect(updateOne).toHaveBeenCalledTimes(2);
  });
});

describe("withLocalizedContent", () => {
  it("attaches description and colorLabels without touching variants", () => {
    const product = {
      id: "runner",
      description: "EN",
      variants: [{ sku: "a", size: "42", color: "Black", stock: 1 }],
    };
    const next = withLocalizedContent(product, {
      description: "DE",
      colorLabels: { Black: "Schwarz" },
    });
    expect(next.description).toBe("DE");
    expect(next.colorLabels).toEqual({ Black: "Schwarz" });
    expect(next.variants?.[0].color).toBe("Black");
  });
});
