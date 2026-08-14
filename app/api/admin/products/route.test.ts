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

import { GET, POST } from "@/app/api/admin/products/route";
import {
  DELETE as DELETE_ONE,
  GET as GET_ONE,
  PATCH,
} from "@/app/api/admin/products/[id]/route";
import { ADMIN, BUYER, catalog } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import { setMockSession } from "@/app/test/session";
import type { ProductDoc } from "@/app/lib/db-collections";
import type { ProductVariant } from "@/app/lib/variants";

type AdminProduct = {
  id: string;
  name: string;
  stock: number;
  variants: ProductVariant[];
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
      GET(),
      POST(jsonRequest("POST", { ...validBody, stock: 1 })),
      GET_ONE(jsonRequest("GET"), params("mug")),
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
    expect((await GET()).status).toBe(401);
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

describe("GET and DELETE", () => {
  it("lists products with their variants", async () => {
    const { body } = await readResponse<AdminProduct[]>(await GET());

    const runner = body.find((p) => p.id === "runner");
    expect(runner?.variants).toHaveLength(3);
    expect(body.find((p) => p.id === "mug")?.variants).toEqual([]);
  });

  it("reads one product", async () => {
    const { status, body } = await readResponse<AdminProduct>(
      await GET_ONE(jsonRequest("GET"), params("runner"))
    );
    expect(status).toBe(200);
    expect(body.id).toBe("runner");
  });

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
