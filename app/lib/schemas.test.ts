import { describe, expect, it } from "vitest";
import { MAX_PRODUCT_IMAGES } from "@/app/lib/images";
import {
  adminProductCreateSchema,
  adminProductUpdateSchema,
  cartPatchSchema,
  cartPostSchema,
  MAX_CART_LINE_ITEMS,
  registerSchema,
  resolveVariants,
} from "@/app/lib/schemas";
import {
  buildCartMetadata,
  encodeCartItemsMetadata,
  STRIPE_METADATA_VALUE_LIMIT,
} from "@/app/lib/cart-metadata";
import { MAX_SKU_LENGTH } from "@/app/lib/variants";
import { parseGuestCheckoutItems } from "@/app/lib/checkout-cart";

describe("MongoDB operator injection", () => {
  // A body like {"productId": {"$gt": ""}} used to pass a truthiness check and
  // reach findOne({ id: productId }) as a live query operator.
  const operatorPayloads = [
    { $gt: "" },
    { $ne: null },
    { $regex: ".*" },
    ["hat"],
    123,
    null,
  ];

  it("rejects non-string productId on cart POST", () => {
    for (const productId of operatorPayloads) {
      expect(cartPostSchema.safeParse({ productId }).success).toBe(false);
    }
    expect(cartPostSchema.safeParse({ productId: "hat" }).success).toBe(true);
  });

  it("rejects non-string productId on cart PATCH", () => {
    for (const productId of operatorPayloads) {
      expect(
        cartPatchSchema.safeParse({ productId, quantity: 1 }).success
      ).toBe(false);
    }
  });

  it("rejects non-string productId in a guest checkout payload", () => {
    for (const productId of operatorPayloads) {
      expect(
        parseGuestCheckoutItems({ items: [{ productId, quantity: 1 }] })
      ).toBeNull();
    }
  });
});

describe("cart quantity bounds", () => {
  it("rejects negative, fractional, and over-max quantities", () => {
    expect(cartPatchSchema.safeParse({ productId: "hat", quantity: -1 }).success).toBe(false);
    expect(cartPatchSchema.safeParse({ productId: "hat", quantity: 1.5 }).success).toBe(false);
    expect(cartPatchSchema.safeParse({ productId: "hat", quantity: 100 }).success).toBe(false);
  });

  it("allows 0, which removes the line item", () => {
    expect(cartPatchSchema.safeParse({ productId: "hat", quantity: 0 }).success).toBe(true);
  });
});

describe("cart line-item cap vs Stripe metadata limit", () => {
  // A cart at the line-item cap, every line at the schema's longest product id
  // and SKU — far past what one 500-char metadata value can hold.
  const worstCase = Array.from({ length: MAX_CART_LINE_ITEMS }, (_, i) => ({
    productId: `${String(i).padStart(2, "0")}${"x".repeat(62)}`, // 64 chars, the schema max
    variantSku: `${String(i).padStart(2, "0")}${"y".repeat(MAX_SKU_LENGTH - 2)}`,
    quantity: 99,
  }));

  it("overflows a single metadata value", () => {
    expect(encodeCartItemsMetadata(worstCase).length).toBeGreaterThan(
      STRIPE_METADATA_VALUE_LIMIT
    );
  });

  it("still fits once split across chunk keys", () => {
    // Fulfillment reads stock decrements out of this metadata, so the largest
    // cart the schemas accept has to survive the round trip.
    const metadata = buildCartMetadata(worstCase);
    expect(metadata).not.toBeNull();
    for (const value of Object.values(metadata!)) {
      expect(value.length).toBeLessThanOrEqual(STRIPE_METADATA_VALUE_LIMIT);
    }
  });

  it("rejects a guest cart over the line-item cap", () => {
    const items = Array.from({ length: MAX_CART_LINE_ITEMS + 1 }, (_, i) => ({
      productId: `p${i}`,
      quantity: 1,
    }));
    expect(parseGuestCheckoutItems({ items })).toBeNull();
  });
});

describe("registerSchema", () => {
  it("lowercases and trims the email", () => {
    const result = registerSchema.parse({
      name: "  Ada  ",
      email: "  Ada@Example.COM ",
      password: "hunter2hunter2",
    });
    expect(result.email).toBe("ada@example.com");
    expect(result.name).toBe("Ada");
  });

  it("rejects short passwords and malformed emails", () => {
    const base = { name: "Ada", email: "ada@example.com", password: "hunter2hunter2" };
    expect(registerSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });
});

describe("adminProductSchema", () => {
  const valid = {
    name: "Hat",
    description: "A hat",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/hat.jpg",
    price: 24.99,
    stock: 10,
  };

  it("accepts a well-formed product", () => {
    expect(adminProductCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative prices and fractional stock", () => {
    expect(adminProductCreateSchema.safeParse({ ...valid, price: -1 }).success).toBe(false);
    expect(adminProductCreateSchema.safeParse({ ...valid, stock: 1.5 }).success).toBe(false);
    expect(adminProductCreateSchema.safeParse({ ...valid, imageUrl: "nope" }).success).toBe(false);
  });

  it("rejects an update with no fields", () => {
    expect(adminProductUpdateSchema.safeParse({}).success).toBe(false);
    expect(adminProductUpdateSchema.safeParse({ stock: 3 }).success).toBe(true);
  });
});

describe("product gallery", () => {
  const valid = {
    name: "Hat",
    description: "A hat",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/hat.jpg",
    price: 24.99,
    stock: 10,
  };

  const photo = (n: number) =>
    `https://res.cloudinary.com/demo/image/upload/v1/hat-${n}.jpg`;

  const gallery = (count: number) =>
    Array.from({ length: count }, (_, i) => photo(i));

  /**
   * The ticket asked for 4–5 images. Five extra shots is the ceiling; the
   * main image sits beside this array, not inside it.
   */
  it("accepts a gallery at the extra-photo cap", () => {
    expect(
      adminProductCreateSchema.safeParse({
        ...valid,
        images: gallery(MAX_PRODUCT_IMAGES),
      }).success
    ).toBe(true);
  });

  it("rejects one photo past the extra-photo cap", () => {
    expect(
      adminProductCreateSchema.safeParse({
        ...valid,
        images: gallery(MAX_PRODUCT_IMAGES + 1),
      }).success
    ).toBe(false);
  });

  it("rejects an entry that is not a URL", () => {
    expect(
      adminProductCreateSchema.safeParse({ ...valid, images: ["nope"] }).success
    ).toBe(false);
  });

  /**
   * No floor: every product predating the gallery has none, and a minimum here
   * would reject them the first time an admin edited anything else.
   */
  it("accepts a product with no gallery at all", () => {
    expect(adminProductCreateSchema.safeParse(valid).success).toBe(true);
    expect(adminProductCreateSchema.safeParse({ ...valid, images: [] }).success).toBe(
      true
    );
  });

  it("takes an empty array on update, which is how a gallery is cleared", () => {
    expect(adminProductUpdateSchema.safeParse({ images: [] }).success).toBe(true);
  });
});

describe("resolveVariants", () => {
  /**
   * The unique index on `variants.sku` cannot catch this — MongoDB
   * de-duplicates one document's multikey entries before comparing them — so
   * this is the only thing standing between two rows and a shared identity.
   */
  it("disambiguates two rows sent with the same explicit SKU", () => {
    const resolved = resolveVariants("runner", [
      { sku: "same-sku", size: "42", color: "Black", stock: 1 },
      { sku: "same-sku", size: "43", color: "Black", stock: 1 },
    ]);

    expect(resolved[0].sku).toBe("same-sku");
    expect(resolved[1].sku).not.toBe("same-sku");
  });

  it("derives a deterministic SKU when a row sends none", () => {
    const resolved = resolveVariants("runner", [
      { size: "42.5", color: "Off White", stock: 1 },
    ]);

    expect(resolved[0].sku).toBe("runner-eu42-5-off-white");
  });
});
