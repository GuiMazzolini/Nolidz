import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

import { GET as GET_ALL } from "@/app/api/products/route";
import { GET as GET_ONE } from "@/app/api/products/[id]/route";
import { catalog } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import type { ProductVariant } from "@/app/lib/variants";

type PublicProduct = { id: string; name: string; variants?: ProductVariant[] };

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
    expect(body[0].variants).toHaveLength(3);
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
      "runner-eu43-black",
      "runner-eu42-white",
    ]);
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
