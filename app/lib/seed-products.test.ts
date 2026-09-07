import { describe, expect, it } from "vitest";

import { SEED_PRODUCTS } from "@/app/lib/seed-products";

describe("seed catalog", () => {
  it("stays empty so the shop does not ship placeholder photography", () => {
    expect(SEED_PRODUCTS).toEqual([]);
  });
});
