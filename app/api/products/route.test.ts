import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

import { GET as GET_ALL } from "@/app/api/products/route";
import { GET as GET_ONE } from "@/app/api/products/[id]/route";
import { catalog, runnerProduct } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import type { ProductVariant } from "@/app/lib/variants";

type PublicProduct = {
  id: string;
  name: string;
  variants?: ProductVariant[];
  colorImages?: { color: string; imageUrl: string }[];
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  testDb.reset();
  testDb.seed("products", catalog);
});

describe("GET /api/products", () => {
  it("returns the catalog with variants attached", async () => {
    const { status, body } = await readResponse<PublicProduct[]>(await GET_ALL());

    expect(status).toBe(200);
    expect(body.map((p) => p.id)).toEqual(["runner", "mug", "pins"]);
    // Three combinations in the fixture, one of them sold out.
    expect(body[0].variants).toHaveLength(2);
  });

  it("keeps a sold-out product listed, without a size run to offer", async () => {
    testDb.reset();
    testDb.seed("products", [
      { ...runnerProduct, stock: 0, variants: runnerProduct.variants?.map((v) => ({ ...v, stock: 0 })) },
    ]);

    const { body } = await readResponse<PublicProduct[]>(await GET_ALL());

    expect(body.map((p) => p.id)).toEqual(["runner"]);
    expect(body[0].variants).toBeUndefined();
  });

  it("does not leak the Mongo _id", async () => {
    const { body } = await readResponse<PublicProduct[]>(await GET_ALL());

    for (const product of body) {
      expect(product).not.toHaveProperty("_id");
    }
  });
});

describe("GET /api/products/[id]", () => {
  it("returns one product with its size run", async () => {
    const { status, body } = await readResponse<PublicProduct>(
      await GET_ONE(jsonRequest("GET"), params("runner"))
    );

    expect(status).toBe(200);
    expect(body.variants?.map((v) => v.sku)).toEqual([
      "runner-eu42-black",
      "runner-eu42-white",
    ]);
  });

  it("hides sold-out sizes rather than sending them with no stock", async () => {
    const { body } = await readResponse<PublicProduct>(
      await GET_ONE(jsonRequest("GET"), params("runner"))
    );

    // EU 43 in Black is the sold-out combination in the fixture.
    expect(body.variants?.map((v) => v.sku)).not.toContain("runner-eu43-black");
    expect(body.variants?.every((v) => v.stock > 0)).toBe(true);
  });

  it("drops the photo of a colourway once its last size sells out", async () => {
    testDb.reset();
    testDb.seed("products", [
      {
        ...runnerProduct,
        stock: 6,
        variants: [
          { sku: "runner-eu42-black", size: "42", color: "Black", stock: 0 },
          { sku: "runner-eu43-black", size: "43", color: "Black", stock: 0 },
          { sku: "runner-eu42-white", size: "42", color: "White", stock: 6 },
        ],
        colorImages: [
          { color: "Black", imageUrl: "https://example.com/black.png" },
          { color: "White", imageUrl: "https://example.com/white.png" },
        ],
      },
    ]);

    const { body } = await readResponse<PublicProduct>(
      await GET_ONE(jsonRequest("GET"), params("runner"))
    );

    expect(body.colorImages?.map((image) => image.color)).toEqual(["White"]);
  });

  it("404s an unknown id", async () => {
    const { status } = await readResponse(
      await GET_ONE(jsonRequest("GET"), params("ghost"))
    );
    expect(status).toBe(404);
  });

  it("does not treat a Mongo operator in the path as a query", async () => {
    // The id arrives as a string from the router, so this can only ever be a
    // literal lookup — it must miss rather than match everything.
    const { status } = await readResponse(
      await GET_ONE(jsonRequest("GET"), params('{"$ne":null}'))
    );
    expect(status).toBe(404);
  });
});
