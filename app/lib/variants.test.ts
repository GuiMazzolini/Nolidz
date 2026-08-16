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
  colorwayPrice,
  formatSize,
  listColors,
  lineItemName,
  resolveLinePrice,
  resolveLineStock,
  sellableVariants,
  serializeVariants,
  sizesAvailableLabel,
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

  it("never counts a broken stock value as sellable units", () => {
    // A hand-edited document or a failed import can leave any of these
    // behind. Each one has to read as sold out, not as stock to sell.
    const broken: ProductVariant[] = [
      { sku: "a", size: "40", color: "Black", stock: -5 },
      { sku: "b", size: "41", color: "Black", stock: Number.NaN },
      { sku: "c", size: "42", color: "Black", stock: Number.POSITIVE_INFINITY },
    ];

    expect(totalVariantStock(broken)).toBe(0);
    for (const variant of broken) {
      expect(resolveLineStock({ variants: broken }, variant.sku)).toBe(0);
    }
  });

  it("floors a fractional count rather than selling a part-pair", () => {
    const variants: ProductVariant[] = [
      { sku: "a", size: "40", color: "Black", stock: 2.7 },
      { sku: "b", size: "41", color: "Black", stock: 3 },
    ];

    expect(totalVariantStock(variants)).toBe(5);
    expect(resolveLineStock({ variants }, "a")).toBe(2);
  });

  it("ignores the product mirror when the SKU is the thing being sold", () => {
    // The mirror can drift — an admin edit, an interrupted hold — and the
    // size's own count is the one that decides whether this line can ship.
    const drifted = { ...runner, stock: 99 };
    expect(resolveLineStock(drifted, "runner-eu43-black")).toBe(0);
  });
});

describe("variants as the client receives them", () => {
  it("keeps a sold-out size, at zero, so the page can strike it through", () => {
    // sellableVariants drops these for the API; serializeVariants must not,
    // or a shopper cannot tell their size exists at all.
    expect(serializeVariants(RUNNER_VARIANTS)).toEqual(RUNNER_VARIANTS);
  });

  it("normalizes broken counts to zero instead of passing them through", () => {
    expect(
      serializeVariants([
        { sku: "a", size: "40", color: "Black", stock: -3 },
        { sku: "b", size: "41", color: "Black", stock: 2.9 },
        { sku: "c", size: "42", color: "Black", stock: Number.NaN },
      ])
    ).toEqual([
      { sku: "a", size: "40", color: "Black", stock: 0 },
      { sku: "b", size: "41", color: "Black", stock: 2 },
      { sku: "c", size: "42", color: "Black", stock: 0 },
    ]);
  });

  it("carries a colourway price through and drops an unusable one", () => {
    const [priced, negative, free] = serializeVariants([
      { sku: "a", size: "40", color: "White", stock: 1, price: 109.99 },
      { sku: "b", size: "41", color: "White", stock: 1, price: -1 },
      { sku: "c", size: "42", color: "White", stock: 1, price: 0 },
    ])!;

    expect(priced.price).toBe(109.99);
    // Falling back to the product price beats charging a negative one.
    expect(negative).not.toHaveProperty("price");
    // Zero is a real price — a giveaway — and must survive.
    expect(free.price).toBe(0);
  });

  it("reads a product with no size run as having no variants", () => {
    expect(serializeVariants([])).toBeUndefined();
    expect(serializeVariants(null)).toBeUndefined();
    expect(serializeVariants(undefined)).toBeUndefined();
  });
});

describe("sizes available, on a catalog card", () => {
  it("names the sizes while there are few enough to scan", () => {
    expect(
      sizesAvailableLabel([
        { sku: "a", size: "40", color: "Black", stock: 1 },
        { sku: "b", size: "42", color: "Black", stock: 2 },
      ])
    ).toBe("EU 40, 42");
  });

  it("stops listing once the run is long enough to stop being scannable", () => {
    expect(
      sizesAvailableLabel([
        { sku: "a", size: "40", color: "Black", stock: 1 },
        { sku: "b", size: "41", color: "Black", stock: 1 },
        { sku: "c", size: "42", color: "Black", stock: 1 },
        { sku: "d", size: "43", color: "Black", stock: 1 },
      ])
    ).toBe("Available in several sizes");
  });

  it("counts only what is in stock towards that cutoff", () => {
    // Three sold-out sizes must not push a two-size card into the summary.
    expect(
      sizesAvailableLabel([
        { sku: "a", size: "40", color: "Black", stock: 1 },
        { sku: "b", size: "41", color: "Black", stock: 0 },
        { sku: "c", size: "42", color: "Black", stock: 0 },
        { sku: "d", size: "43", color: "Black", stock: 0 },
        { sku: "e", size: "44", color: "Black", stock: 2 },
      ])
    ).toBe("EU 40, 44");
  });

  it("leaves the EU prefix off sizes that are not numbers", () => {
    expect(
      sizesAvailableLabel([
        { sku: "a", size: "One size", color: "Cream", stock: 1 },
      ])
    ).toBe("One size");
  });

  it("says nothing when there is nothing left to offer", () => {
    expect(
      sizesAvailableLabel([{ sku: "a", size: "40", color: "Black", stock: 0 }])
    ).toBeNull();
    expect(sizesAvailableLabel([])).toBeNull();
  });
});

describe("variant price", () => {
  it("falls back to the product price when a colour has none of its own", () => {
    expect(resolveLinePrice(runner, "runner-eu42-black")).toBe(89.99);
    expect(colorwayPrice(runner, "Black")).toBe(89.99);
  });

  it("charges the colourway's price at checkout, not the product's", () => {
    const priced = {
      ...runner,
      variants: RUNNER_VARIANTS.map((variant) =>
        variant.color === "White" ? { ...variant, price: 109.99 } : variant
      ),
    };

    expect(resolveLinePrice(priced, "runner-eu41-5-white")).toBe(109.99);
    expect(resolveLinePrice(priced, "runner-eu42-black")).toBe(89.99);
    expect(colorwayPrice(priced, "White")).toBe(109.99);
    expect(colorwayPrice(priced, "Black")).toBe(89.99);
  });

  it("prices a single-SKU product from the product itself", () => {
    expect(resolveLinePrice({ price: 14.99 })).toBe(14.99);
    expect(colorwayPrice({ price: 14.99 }, null)).toBe(14.99);
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

  it("attaches the chosen size, colour, and that colour's price", () => {
    const priced = {
      ...runner,
      variants: RUNNER_VARIANTS.map((variant) =>
        variant.color === "White" ? { ...variant, price: 109.99 } : variant
      ),
    };

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

    expect(
      attachQuantitiesToProducts(
        [{ productId: "runner", quantity: 1, variantSku: "runner-eu41-5-white" }],
        [priced]
      )[0].price
    ).toBe(109.99);
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

  it("keeps two sizes of one shoe as two separate lines", () => {
    // Same product id twice: collapsing these would decrement one size twice
    // and leave the other oversold.
    const items = [
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 2, variantSku: "runner-eu43-black" },
    ];
    expect(decodeCartMetadata(buildCartMetadata(items)!)).toEqual(items);
  });

  it("survives a SKU built from a half size and a two-word colour", () => {
    // The real generator's output, through the separators it has to avoid.
    const sku = buildVariantSku("runner-low", "42.5", "Off White");
    expect(sku).not.toMatch(/[,:|]/);
    expect(
      decodeCartMetadata(
        buildCartMetadata([{ productId: "runner-low", quantity: 1, variantSku: sku }])!
      )
    ).toEqual([{ productId: "runner-low", quantity: 1, variantSku: sku }]);
  });

  it("numbers the chunk keys from the second one, and packs them in order", () => {
    // One line per chunk: 249 + ":1" is 251, so no two fit in 500 characters.
    const items = Array.from({ length: MAX_CART_METADATA_CHUNKS }, (_, i) => ({
      productId: `${String(i).padStart(3, "0")}${"x".repeat(246)}`,
      quantity: 1,
    }));

    const metadata = buildCartMetadata(items)!;
    expect(Object.keys(metadata)).toEqual([
      "cartItems",
      ...Array.from({ length: MAX_CART_METADATA_CHUNKS - 1 }, (_, i) => `cartItems${i + 2}`),
    ]);
    // Fulfillment decrements in this order, so it has to come back in it.
    expect(decodeCartMetadata(metadata)).toEqual(items);
  });

  it("refuses the cart that needs one chunk more than the budget", () => {
    const oneLinePerChunk = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        productId: `${String(i).padStart(3, "0")}${"x".repeat(246)}`,
        quantity: 1,
      }));

    expect(buildCartMetadata(oneLinePerChunk(MAX_CART_METADATA_CHUNKS))).not.toBeNull();
    // Refused outright: encoding all but the last line would check out a cart
    // whose stock nothing ever decrements.
    expect(buildCartMetadata(oneLinePerChunk(MAX_CART_METADATA_CHUNKS + 1))).toBeNull();
  });

  it("refuses one line too long to fit any single metadata value", () => {
    expect(
      buildCartMetadata([
        { productId: "x".repeat(STRIPE_METADATA_VALUE_LIMIT + 1), quantity: 1 },
      ])
    ).toBeNull();
  });

  it("encodes an empty cart as no cartItems key at all", () => {
    // Not null: nothing to encode is not the same as a cart that overflowed,
    // and the checkout route turns null into a hard refusal.
    expect(buildCartMetadata([])).toEqual({});
    expect(decodeCartMetadata({})).toEqual([]);
    expect(decodeCartMetadata(null)).toEqual([]);
    expect(decodeCartMetadata(undefined)).toEqual([]);
  });

  it("drops a line it cannot trust rather than guessing a quantity", () => {
    // Fulfillment decrements from this, so a quantity that is not a whole
    // positive number has to be discarded, never rounded or defaulted to one.
    expect(
      decodeCartMetadata({
        cartItems: "good:2,zero:0,negative:-1,fractional:1.5,words:many,noqty,:3",
      })
    ).toEqual([{ productId: "good", quantity: 2 }]);
  });

  it("ignores metadata Stripe carries alongside the cart", () => {
    expect(
      decodeCartMetadata({
        userId: "buyer@example.com",
        reservationId: "res_1",
        cartItems: "runner|runner-eu42-black:1",
      })
    ).toEqual([{ productId: "runner", quantity: 1, variantSku: "runner-eu42-black" }]);
  });
});

describe("admin variant input", () => {
  const base = {
    name: "Runner",
    description: "A shoe",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/runner.png",
    price: 89.99,
    category: "men",
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
