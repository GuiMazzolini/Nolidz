import { describe, expect, it } from "vitest";
import { isSellableForPublic } from "@/app/lib/public-products";

describe("isSellableForPublic", () => {
  it("keeps a single-SKU product with stock", () => {
    expect(isSellableForPublic({ stock: 2 })).toBe(true);
  });

  it("hides a single-SKU product with no stock", () => {
    expect(isSellableForPublic({ stock: 0 })).toBe(false);
  });

  it("keeps a sized product when any size remains", () => {
    expect(
      isSellableForPublic({
        stock: 0,
        variants: [
          { sku: "a", size: "42", color: "Black", stock: 0 },
          { sku: "b", size: "43", color: "Black", stock: 1 },
        ],
      })
    ).toBe(true);
  });

  it("hides a sized product when every size is gone", () => {
    expect(
      isSellableForPublic({
        stock: 0,
        variants: [
          { sku: "a", size: "42", color: "Black", stock: 0 },
          { sku: "b", size: "43", color: "Black", stock: 0 },
        ],
      })
    ).toBe(false);
  });
});
