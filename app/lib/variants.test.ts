import { describe, expect, it } from "vitest";
import {
  buildCartMetadata,
  decodeCartMetadata,
  MAX_CART_METADATA_CHUNKS,
  STRIPE_METADATA_VALUE_LIMIT,
} from "@/app/lib/cart-metadata";
import {
  attachQuantitiesToProducts,
  getCartStockError,
} from "@/app/lib/checkout-cart";
import { adminProductCreateSchema, resolveVariants } from "@/app/lib/schemas";
import {
  buildVariantSku,
  cartLineKey,
  formatSize,
  listColors,
  lineItemName,
  resolveLineStock,
  sellableVariants,
  sizesLeftLabel,
  totalVariantStock,
  variantsForColor,
  type ProductVariant,
} from "@/app/lib/variants";

const RUNNER_VARIANTS: ProductVariant[] = [
  { sku: "runner-eu42-black", size: "42", color: "Black", stock: 3 },
  { sku: "runner-eu43-black", size: "43", color: "Black", stock: 0 },
  { sku: "runner-eu41-5-white", size: "41.5", color: "White", stock: 5 },
];

const runner = {
  id: "runner",
  name: "Runner",
  price: 89.99,
  stock: 8,
  variants: RUNNER_VARIANTS,
};

describe("variant identity", () => {
  it("builds a deterministic SKU from product, EU size, and colour", () => {
    expect(buildVariantSku("runner", "42.5", "Off White")).toBe(
      "runner-eu42-5-off-white"
    );
    expect(buildVariantSku("runner", "42", "Black")).toBe(
      buildVariantSku("runner", "42", "Black")
    );
  });

  it("keys cart lines per size so two sizes stay separate", () => {
    expect(cartLineKey("runner", "runner-eu42-black")).not.toBe(
      cartLineKey("runner", "runner-eu43-black")
    );
    // A single-SKU product keeps its bare product id as the key.
    expect(cartLineKey("mug")).toBe("mug");
  });

  it("labels line items with size and colour", () => {
    expect(lineItemName("Runner", "42", "Black")).toBe("Runner — EU 42 · Black");
    expect(lineItemName("Mug")).toBe("Mug");
  });

  it("prefixes EU only for numeric sizes", () => {
    // "EU One size" reads like a bug, so accessories keep their own wording.
    expect(formatSize("42")).toBe("EU 42");
    expect(formatSize("42.5")).toBe("EU 42.5");
    expect(formatSize("One size")).toBe("One size");
    expect(lineItemName("Mug", "One size", "Cream")).toBe(
      "Mug — One size · Cream"
    );
  });
});

describe("sizes left, for a catalog card", () => {
  it("lists the sizes a shopper can still buy", () => {
    expect(
      sizesLeftLabel([
        { sku: "a", size: "40", color: "Black", stock: 1 },
        { sku: "b", size: "42", color: "Black", stock: 2 },
      ])
    ).toBe("Sizes left: EU 40, 42");
  });

  it("leaves out sold-out sizes rather than implying a full run", () => {
    // A range would read "EU 40-45" here and send someone to a dead end.
    expect(
      sizesLeftLabel([
        { sku: "a", size: "40", color: "Black", stock: 0 },
        { sku: "b", size: "42", color: "Black", stock: 3 },
        { sku: "c", size: "45", color: "Black", stock: 0 },
      ])
    ).toBe("Size left: EU 42");
  });

  it("counts a size once when several colourways stock it", () => {
    expect(
      sizesLeftLabel([
        { sku: "a", size: "42", color: "Black", stock: 1 },
        { sku: "b", size: "42", color: "White", stock: 2 },
        { sku: "c", size: "43", color: "White", stock: 1 },
      ])
    ).toBe("Sizes left: EU 42, 43");
  });

  it("orders sizes numerically, half sizes in place", () => {
    expect(
      sizesLeftLabel([
        { sku: "a", size: "44", color: "Black", stock: 1 },
        { sku: "b", size: "41.5", color: "Black", stock: 1 },
        { sku: "c", size: "40", color: "Black", stock: 1 },
      ])
    ).toBe("Sizes left: EU 40, 41.5, 44");
  });

  it("shows a full shoe run without truncating it", () => {
    const variants = ["40", "41", "42", "42.5", "43", "44", "45", "46"].map(
      (size) => ({ sku: `s-${size}`, size, color: "Black", stock: 1 })
    );
    expect(sizesLeftLabel(variants)).toBe(
      "Sizes left: EU 40, 41, 42, 42.5, 43, 44, 45, 46"
    );
  });

  it("summarises a run past the cutoff", () => {
    const variants = ["36", "37", "38", "39", "40", "41", "42", "43"].map(
      (size) => ({ sku: `s-${size}`, size, color: "Black", stock: 1 })
    );
    expect(sizesLeftLabel(variants, 6)).toBe(
      "Sizes left: EU 36, 37, 38, 39, 40, 41 +2"
    );
  });

  it("says nothing for a product that only comes in one size", () => {
    // "One size" next to the stock count on the card is noise.
    expect(
      sizesLeftLabel([
        { sku: "a", size: "One size", color: "Cream", stock: 1 },
        { sku: "b", size: "One size", color: "Black", stock: 4 },
      ])
    ).toBeNull();
  });

  it("says nothing when every size is sold out", () => {
    expect(
      sizesLeftLabel([
        { sku: "a", size: "40", color: "Black", stock: 0 },
        { sku: "b", size: "42", color: "Black", stock: 0 },
      ])
    ).toBeNull();
    expect(sizesLeftLabel([])).toBeNull();
  });
});

describe("variant stock", () => {
  it("totals stock across every combination", () => {
    expect(totalVariantStock(RUNNER_VARIANTS)).toBe(8);
  });

  it("resolves stock per combination, not from the pooled total", () => {
    expect(resolveLineStock(runner, "runner-eu42-black")).toBe(3);
    expect(resolveLineStock(runner, "runner-eu43-black")).toBe(0);
  });

  it("treats a variant product with no SKU as unsellable", () => {
    expect(resolveLineStock(runner)).toBe(0);
    expect(resolveLineStock(runner, "does-not-exist")).toBe(0);
  });

  it("falls back to the product count when there are no variants", () => {
    expect(resolveLineStock({ stock: 4 })).toBe(4);
    expect(resolveLineStock({ stock: -2 })).toBe(0);
  });
});

describe("variants offered by the public API", () => {
  it("drops the sold-out combinations", () => {
    expect(sellableVariants(RUNNER_VARIANTS)?.map((v) => v.sku)).toEqual([
      "runner-eu42-black",
      "runner-eu41-5-white",
    ]);
  });

  it("reads a fully sold-out run as no variants at all", () => {
    const gone = RUNNER_VARIANTS.map((v) => ({ ...v, stock: 0 }));
    expect(sellableVariants(gone)).toBeUndefined();
    expect(sellableVariants([])).toBeUndefined();
    expect(sellableVariants(undefined)).toBeUndefined();
  });

  it("floors a negative count to sold out rather than offering it", () => {
    expect(
      sellableVariants([{ sku: "a", size: "42", color: "Black", stock: -3 }])
    ).toBeUndefined();
  });
});

describe("variant grouping for the product page", () => {
  it("lists colours once, in entry order", () => {
    expect(listColors(RUNNER_VARIANTS)).toEqual(["Black", "White"]);
  });

  it("sorts a colour's sizes numerically, half sizes included", () => {
    const sizes = variantsForColor(
      [
        { sku: "a", size: "44", color: "Black", stock: 1 },
        { sku: "b", size: "41.5", color: "Black", stock: 1 },
        { sku: "c", size: "42", color: "White", stock: 1 },
      ],
      "black"
    ).map((v) => v.size);
    expect(sizes).toEqual(["41.5", "44"]);
  });
});

describe("checkout stock validation with variants", () => {
  it("blocks a size that is sold out while others remain", () => {
    expect(
      getCartStockError(
        [{ productId: "runner", quantity: 1, variantSku: "runner-eu43-black" }],
        [runner]
      )
    ).toBe("Runner (EU 43 · Black) is out of stock");
  });

  it("reports the remaining count for that size only", () => {
    expect(
      getCartStockError(
        [{ productId: "runner", quantity: 4, variantSku: "runner-eu42-black" }],
        [runner]
      )
    ).toBe("Only 3 of Runner (EU 42 · Black) left in stock");
  });

  it("refuses a variant product with no size chosen", () => {
    expect(
      getCartStockError([{ productId: "runner", quantity: 1 }], [runner])
    ).toBe("Please choose a size and colour for Runner");
  });

  it("attaches the chosen size and colour to the checkout line", () => {
    expect(
      attachQuantitiesToProducts(
        [{ productId: "runner", quantity: 2, variantSku: "runner-eu42-black" }],
        [runner]
      )
    ).toEqual([
      {
        id: "runner",
        name: "Runner",
        price: 89.99,
        description: undefined,
        imageUrl: undefined,
        stock: 3,
        quantity: 2,
        variantSku: "runner-eu42-black",
        variantSize: "42",
        variantColor: "Black",
      },
    ]);
  });
});

describe("stripe cart metadata with variants", () => {
  it("round-trips variant lines", () => {
    const items = [
      { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
      { productId: "mug", quantity: 1 },
    ];
    const metadata = buildCartMetadata(items);
    expect(metadata).toEqual({
      cartItems: "runner|runner-eu42-black:2,mug:1",
    });
    expect(decodeCartMetadata(metadata)).toEqual(items);
  });

  it("splits a long cart across chunk keys and reassembles it in order", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      productId: `product-with-a-long-id-${i}`,
      quantity: 1,
      variantSku: `product-with-a-long-id-${i}-eu42-core-black`,
    }));

    const metadata = buildCartMetadata(items);
    expect(metadata).not.toBeNull();
    expect(Object.keys(metadata!).length).toBeGreaterThan(1);
    for (const value of Object.values(metadata!)) {
      expect(value.length).toBeLessThanOrEqual(STRIPE_METADATA_VALUE_LIMIT);
    }
    expect(decodeCartMetadata(metadata)).toEqual(items);
  });

  it("refuses a cart that cannot be encoded within the chunk budget", () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      productId: `a-very-long-product-identifier-${i}`,
      quantity: 1,
      variantSku: `a-very-long-product-identifier-${i}-eu42-core-black`,
    }));
    expect(buildCartMetadata(items)).toBeNull();
    expect(items.length / MAX_CART_METADATA_CHUNKS).toBeGreaterThan(1);
  });

  it("still decodes sessions created before variants existed", () => {
    expect(decodeCartMetadata({ cartItems: "hat:2,shirt:1" })).toEqual([
      { productId: "hat", quantity: 2 },
      { productId: "shirt", quantity: 1 },
    ]);
  });
});

describe("admin variant input", () => {
  const base = {
    name: "Runner",
    description: "A shoe",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/runner.png",
    price: 89.99,
  };

  it("accepts a size run and derives SKUs from the product id", () => {
    const parsed = adminProductCreateSchema.parse({
      ...base,
      variants: [
        { size: "42", color: "Black", stock: 3 },
        { size: "42.5", color: "Black", stock: 1 },
      ],
    });

    expect(resolveVariants("runner", parsed.variants!)).toEqual([
      { sku: "runner-eu42-black", size: "42", color: "Black", stock: 3 },
      { sku: "runner-eu42-5-black", size: "42.5", color: "Black", stock: 1 },
    ]);
  });

  it("keeps SKUs supplied by the client so existing carts stay valid", () => {
    const resolved = resolveVariants("runner", [
      { sku: "legacy-sku", size: "42", color: "Black", stock: 3 },
    ]);
    expect(resolved[0].sku).toBe("legacy-sku");
  });

  it("rejects the same size and colour twice", () => {
    const result = adminProductCreateSchema.safeParse({
      ...base,
      variants: [
        { size: "42", color: "Black", stock: 3 },
        { size: "42", color: "black", stock: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("requires either a stock count or variants", () => {
    expect(adminProductCreateSchema.safeParse(base).success).toBe(false);
    expect(
      adminProductCreateSchema.safeParse({ ...base, stock: 5 }).success
    ).toBe(true);
  });

  it("rejects a SKU carrying a metadata separator", () => {
    const result = adminProductCreateSchema.safeParse({
      ...base,
      variants: [{ sku: "bad|sku", size: "42", color: "Black", stock: 1 }],
    });
    expect(result.success).toBe(false);
  });
});
