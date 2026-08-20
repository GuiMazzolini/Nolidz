import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

import { POST } from "@/app/api/admin/products/route";
import {
  DELETE as DELETE_ONE,
  PATCH,
} from "@/app/api/admin/products/[id]/route";
import { ADMIN, BUYER, catalog } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import { setMockSession } from "@/app/test/session";
import { MAX_PRODUCT_IMAGES } from "@/app/lib/images";
import type { ProductDoc } from "@/app/lib/db-collections";
import type { ProductVariant } from "@/app/lib/variants";
import { serializeAdminProduct } from "@/app/lib/admin-products";
import {
  commitHold,
  heldStockFor,
  holdStock,
  releaseHold,
} from "@/app/lib/stock-hold";

type AdminProduct = {
  id: string;
  name: string;
  stock: number;
  variants: ProductVariant[];
  colorImages: { color: string; imageUrl: string }[];
  images: string[];
};

const IMAGE = "https://res.cloudinary.com/demo/image/upload/new.png";

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function stored(id: string): ProductDoc | undefined {
  return testDb.all("products").find((doc) => doc.id === id) as
    | ProductDoc
    | undefined;
}

const validBody = {
  name: "New Shoe",
  description: "Fresh",
  imageUrl: IMAGE,
  price: 100,
  category: "men",
};

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  testDb.reset();
  testDb.seed("products", catalog);
  setMockSession(ADMIN);
});

describe("admin authorization", () => {
  it("locks every handler to an address on the admin list", async () => {
    setMockSession(BUYER);

    const responses = await Promise.all([
      POST(jsonRequest("POST", { ...validBody, stock: 1 })),
      PATCH(jsonRequest("PATCH", { price: 1 }), params("mug")),
      DELETE_ONE(jsonRequest("DELETE"), params("mug")),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
    expect(stored("mug")?.price).toBe(14.99);
  });

  it("locks out a signed-out visitor", async () => {
    setMockSession(null);
    expect(
      (await POST(jsonRequest("POST", { ...validBody, stock: 1 }))).status
    ).toBe(401);
  });
});

describe("POST /api/admin/products", () => {
  it("creates a single-SKU product from an explicit stock count", async () => {
    const { status, body } = await readResponse<AdminProduct>(
      await POST(jsonRequest("POST", { ...validBody, stock: 7 }))
    );

    expect(status).toBe(201);
    expect(body).toMatchObject({ id: "new-shoe", stock: 7, variants: [] });
    expect(stored("new-shoe")?.variants).toBeUndefined();
  });

  it("derives SKUs and total stock from the size run", async () => {
    const { status, body } = await readResponse<AdminProduct>(
      await POST(
        jsonRequest("POST", {
          ...validBody,
          variants: [
            { size: "42", color: "Black", stock: 3 },
            { size: "42.5", color: "Black", stock: 2 },
            { size: "42", color: "Bone White", stock: 1 },
          ],
        })
      )
    );

    expect(status).toBe(201);
    expect(body.stock).toBe(6);
    expect(body.variants.map((v) => v.sku)).toEqual([
      "new-shoe-eu42-black",
      "new-shoe-eu42-5-black",
      "new-shoe-eu42-bone-white",
    ]);
  });

  it("stores a photo per colourway", async () => {
    const { body } = await readResponse<AdminProduct>(
      await POST(
        jsonRequest("POST", {
          ...validBody,
          variants: [
            { size: "42", color: "Black", stock: 3 },
            { size: "42", color: "White", stock: 1 },
          ],
          colorImages: [
            { color: "Black", imageUrl: IMAGE },
            {
              color: "White",
              imageUrl: "https://res.cloudinary.com/demo/image/upload/white.png",
            },
          ],
        })
      )
    );

    expect(body.colorImages).toEqual([
      { color: "Black", imageUrl: IMAGE },
      {
        color: "White",
        imageUrl: "https://res.cloudinary.com/demo/image/upload/white.png",
      },
    ]);
  });

  it("holds colour photos to the same host allowlist as the main image", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(
        jsonRequest("POST", {
          ...validBody,
          variants: [{ size: "42", color: "Black", stock: 1 }],
          colorImages: [
            { color: "Black", imageUrl: "https://evil.example.com/x.png" },
          ],
        })
      )
    );

    expect(status).toBe(400);
    expect(body.error).toContain("res.cloudinary.com");
  });

  it("stores a price per colourway", async () => {
    await POST(
      jsonRequest("POST", {
        ...validBody,
        id: "priced",
        variants: [
          { size: "42", color: "Black", stock: 1, price: 89.99 },
          { size: "42", color: "White", stock: 1, price: 109.99 },
        ],
      })
    );

    expect(stored("priced")?.variants?.map((v) => v.price)).toEqual([89.99, 109.99]);
  });

  it("ignores a stock count sent alongside variants", async () => {
    const { body } = await readResponse<AdminProduct>(
      await POST(
        jsonRequest("POST", {
          ...validBody,
          stock: 999,
          variants: [{ size: "42", color: "Black", stock: 3 }],
        })
      )
    );

    expect(body.stock).toBe(3);
  });

  it("requires either a stock count or variants", async () => {
    const { status } = await readResponse(await POST(jsonRequest("POST", validBody)));
    expect(status).toBe(400);
  });

  it("rejects the same size and colour twice", async () => {
    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", {
          ...validBody,
          variants: [
            { size: "42", color: "Black", stock: 3 },
            { size: "42", color: "black", stock: 1 },
          ],
        })
      )
    );
    expect(status).toBe(400);
  });

  it("rejects an image URL off the allowlist", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(
        jsonRequest("POST", {
          ...validBody,
          stock: 1,
          imageUrl: "https://evil.example.com/x.png",
        })
      )
    );

    expect(status).toBe(400);
    expect(body.error).toContain("res.cloudinary.com");
  });

  it("rejects a plain-http image URL", async () => {
    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", {
          ...validBody,
          stock: 1,
          imageUrl: "http://res.cloudinary.com/demo/image/upload/x.png",
        })
      )
    );
    expect(status).toBe(400);
  });

  it("stores the extra gallery photos in order", async () => {
    const second = "https://res.cloudinary.com/demo/image/upload/sole.png";
    const { body } = await readResponse<AdminProduct>(
      await POST(
        jsonRequest("POST", { ...validBody, stock: 1, images: [IMAGE, second] })
      )
    );

    expect(body.images).toEqual([IMAGE, second]);
  });

  it("holds gallery photos to the same host allowlist as the main image", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(
        jsonRequest("POST", {
          ...validBody,
          stock: 1,
          images: ["https://evil.example.com/x.png"],
        })
      )
    );

    expect(status).toBe(400);
    expect(body.error).toContain("res.cloudinary.com");
  });

  it("stores a gallery at the extra-photo cap", async () => {
    const many = Array.from(
      { length: MAX_PRODUCT_IMAGES },
      (_, i) => `https://res.cloudinary.com/demo/image/upload/p${i}.png`
    );

    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", { ...validBody, id: "many", stock: 1, images: many })
      )
    );

    expect(status).toBe(201);
    expect(stored("many")?.images).toHaveLength(MAX_PRODUCT_IMAGES);
  });

  it("rejects a gallery past the extra-photo cap", async () => {
    const tooMany = Array.from(
      { length: MAX_PRODUCT_IMAGES + 1 },
      (_, i) => `https://res.cloudinary.com/demo/image/upload/p${i}.png`
    );

    const { status } = await readResponse(
      await POST(
        jsonRequest("POST", { ...validBody, id: "too-many", stock: 1, images: tooMany })
      )
    );

    expect(status).toBe(400);
    expect(stored("too-many")).toBeUndefined();
  });

  it("stores no gallery key when none is sent", async () => {
    await POST(jsonRequest("POST", { ...validBody, id: "plain", stock: 1 }));
    expect(stored("plain")).not.toHaveProperty("images");
  });

  it("409s a duplicate id", async () => {
    const { status } = await readResponse(
      await POST(jsonRequest("POST", { ...validBody, id: "mug", stock: 1 }))
    );
    expect(status).toBe(409);
  });

  it("slugifies a supplied id", async () => {
    await POST(
      jsonRequest("POST", { ...validBody, id: "Air Max 90!", stock: 1 })
    );
    expect(stored("air-max-90")).toBeTruthy();
  });
});

describe("PATCH /api/admin/products/[id]", () => {
  it("replaces the size run and recomputes the total", async () => {
    const { status, body } = await readResponse<AdminProduct>(
      await PATCH(
        jsonRequest("PATCH", {
          variants: [
            { sku: "runner-eu42-black", size: "42", color: "Black", stock: 10 },
            { size: "44", color: "Black", stock: 5 },
          ],
        }),
        params("runner")
      )
    );

    expect(status).toBe(200);
    expect(body.stock).toBe(15);
    // The existing SKU is preserved, so carts holding it stay valid.
    expect(body.variants[0].sku).toBe("runner-eu42-black");
    expect(body.variants[1].sku).toBe("runner-eu44-black");
  });

  it("replaces the colour photos", async () => {
    const { body } = await readResponse<AdminProduct>(
      await PATCH(
        jsonRequest("PATCH", {
          colorImages: [{ color: "Black", imageUrl: IMAGE }],
        }),
        params("runner")
      )
    );

    expect(body.colorImages).toEqual([{ color: "Black", imageUrl: IMAGE }]);
  });

  it("clears the colour photos with an empty array", async () => {
    await PATCH(
      jsonRequest("PATCH", { colorImages: [{ color: "Black", imageUrl: IMAGE }] }),
      params("runner")
    );

    const { body } = await readResponse<AdminProduct>(
      await PATCH(jsonRequest("PATCH", { colorImages: [] }), params("runner"))
    );

    expect(body.colorImages).toEqual([]);
    expect(stored("runner")).not.toHaveProperty("colorImages");
  });

  it("replaces the gallery", async () => {
    const { body } = await readResponse<AdminProduct>(
      await PATCH(jsonRequest("PATCH", { images: [IMAGE] }), params("runner"))
    );

    expect(body.images).toEqual([IMAGE]);
  });

  it("clears the gallery with an empty array", async () => {
    await PATCH(jsonRequest("PATCH", { images: [IMAGE] }), params("runner"));

    const { body } = await readResponse<AdminProduct>(
      await PATCH(jsonRequest("PATCH", { images: [] }), params("runner"))
    );

    expect(body.images).toEqual([]);
    expect(stored("runner")).not.toHaveProperty("images");
  });

  it("leaves the gallery alone when the field is omitted", async () => {
    await PATCH(jsonRequest("PATCH", { images: [IMAGE] }), params("runner"));
    await PATCH(jsonRequest("PATCH", { name: "Renamed" }), params("runner"));

    expect(stored("runner")?.images).toEqual([IMAGE]);
  });

  it("holds a replaced gallery to the host allowlist", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await PATCH(
        jsonRequest("PATCH", { images: ["https://evil.example.com/x.png"] }),
        params("runner")
      )
    );

    expect(status).toBe(400);
    expect(body.error).toContain("res.cloudinary.com");
  });

  it("refuses a direct stock edit on a variant product", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await PATCH(jsonRequest("PATCH", { stock: 99 }), params("runner"))
    );

    expect(status).toBe(400);
    expect(body.error).toContain("total of its size/colour variants");
    expect(stored("runner")?.stock).toBe(9);
  });

  it("clears the variants and returns the product to a single SKU", async () => {
    const { body } = await readResponse<AdminProduct>(
      await PATCH(
        jsonRequest("PATCH", { variants: [], stock: 4 }),
        params("runner")
      )
    );

    expect(body.variants).toEqual([]);
    expect(body.stock).toBe(4);
    expect(stored("runner")).not.toHaveProperty("variants");
  });

  it("updates stock directly on a single-SKU product", async () => {
    const { body } = await readResponse<AdminProduct>(
      await PATCH(jsonRequest("PATCH", { stock: 12 }), params("mug"))
    );
    expect(body.stock).toBe(12);
  });

  it("leaves variants alone when the field is omitted", async () => {
    await PATCH(jsonRequest("PATCH", { name: "Renamed" }), params("runner"));

    const doc = stored("runner");
    expect(doc?.name).toBe("Renamed");
    expect(doc?.variants).toHaveLength(3);
    expect(doc?.stock).toBe(9);
  });

  it("rejects an empty body", async () => {
    const { status } = await readResponse(
      await PATCH(jsonRequest("PATCH", {}), params("mug"))
    );
    expect(status).toBe(400);
  });

  it("404s an unknown product", async () => {
    const { status } = await readResponse(
      await PATCH(jsonRequest("PATCH", { price: 5 }), params("ghost"))
    );
    expect(status).toBe(404);
  });
});

describe("DELETE /api/admin/products/[id]", () => {
  it("deletes a product, then 404s the second attempt", async () => {
    expect(
      (await DELETE_ONE(jsonRequest("DELETE"), params("mug"))).status
    ).toBe(200);
    expect(stored("mug")).toBeUndefined();
    expect(
      (await DELETE_ONE(jsonRequest("DELETE"), params("mug"))).status
    ).toBe(404);
  });
});

describe("admin stock while checkouts are in progress", () => {
  /** Two pairs of EU 42 Black are held by a checkout that has not paid yet. */
  async function holdTwoBlack42() {
    await holdStock(testDb as never, {
      reservationId: "r1",
      holder: "shopper@example.com",
      lines: [
        { productId: "runner", quantity: 2, variantSku: "runner-eu42-black" },
      ],
    });
  }

  it("shows the admin what is on the shelf, not what is left to sell", async () => {
    await holdTwoBlack42();
    // The catalog now offers one; the stockroom still has three.
    expect(stored("runner")!.variants![0].stock).toBe(1);

    const held = (await heldStockFor(testDb as never, ["runner"])).get("runner");
    const body = serializeAdminProduct(stored("runner")!, held);

    expect(body.variants[0].stock).toBe(3);
    expect(body.heldForCheckout).toBe(2);
  });

  it("does not invent stock when a held checkout is later abandoned", async () => {
    await holdTwoBlack42();

    // The admin counts the shelf, finds ten, and saves that.
    await PATCH(
      jsonRequest("PATCH", {
        variants: [
          { sku: "runner-eu42-black", size: "42", color: "Black", stock: 10 },
        ],
      }),
      params("runner")
    );

    // Eight are sellable now; two are still spoken for.
    expect(stored("runner")!.variants![0].stock).toBe(8);

    await releaseHold(testDb as never, "r1", "expired");

    // Ten on the shelf, ten for sale. Writing 10 verbatim would have given 12.
    expect(stored("runner")!.variants![0].stock).toBe(10);
    expect(stored("runner")!.stock).toBe(10);
  });

  it("keeps the shelf count stable when a held checkout is paid for", async () => {
    await holdTwoBlack42();

    await PATCH(
      jsonRequest("PATCH", {
        variants: [
          { sku: "runner-eu42-black", size: "42", color: "Black", stock: 10 },
        ],
      }),
      params("runner")
    );
    await commitHold(testDb as never, "r1");

    // Two shipped, eight remain and all eight are sellable.
    expect(stored("runner")!.variants![0].stock).toBe(8);
  });

  it("reconciles a single-SKU product the same way", async () => {
    await holdStock(testDb as never, {
      reservationId: "r2",
      holder: "shopper@example.com",
      lines: [{ productId: "mug", quantity: 1 }],
    });

    await PATCH(jsonRequest("PATCH", { stock: 20 }), params("mug"));
    expect(stored("mug")!.stock).toBe(19);

    await releaseHold(testDb as never, "r2", "expired");
    expect(stored("mug")!.stock).toBe(20);
  });

  it("goes negative rather than hiding a genuine oversell", async () => {
    await holdTwoBlack42();

    // The admin finds only one pair on the shelf, but two are already sold.
    await PATCH(
      jsonRequest("PATCH", {
        variants: [
          { sku: "runner-eu42-black", size: "42", color: "Black", stock: 1 },
        ],
      }),
      params("runner")
    );

    // Nothing further can be sold until the count recovers, which is the
    // point — clamping to zero would let it be oversold again.
    expect(stored("runner")!.variants![0].stock).toBe(-1);
  });

  it("leaves the listing alone when nothing is held", async () => {
    const body = serializeAdminProduct(stored("runner")!);
    expect(body.variants[0].stock).toBe(3);
    expect(body.heldForCheckout).toBe(0);
  });
});
