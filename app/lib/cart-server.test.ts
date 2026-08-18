import { beforeEach, describe, expect, it } from "vitest";

import { loadCartProducts, serializeCartProduct } from "@/app/lib/cart-server";
import type { CartItemDoc } from "@/app/lib/db-collections";
import { catalog, mugProduct, runnerProduct } from "@/app/test/fixtures";
import { testDb } from "@/app/test/mongo-double";

/**
 * The cart join used to live in three places — both cart routes and the cart
 * page — and drifted between them. These cover the shared version directly,
 * so the rules about what drops out of a cart are pinned in one place rather
 * than inferred from whichever route happens to exercise them.
 */

const db = testDb as never;

function line(
  productId: string,
  quantity = 1,
  variantSku?: string
): CartItemDoc {
  return { productId, quantity, ...(variantSku ? { variantSku } : {}) };
}

beforeEach(() => {
  testDb.reset();
  testDb.seed("products", catalog);
});

describe("loadCartProducts", () => {
  it("returns nothing for an empty cart without querying", async () => {
    await expect(loadCartProducts(db, [])).resolves.toEqual([]);
  });

  it("joins a single-SKU line to its product", async () => {
    const [item] = await loadCartProducts(db, [line("mug", 2)]);

    expect(item).toMatchObject({
      id: "mug",
      name: "Mug",
      price: mugProduct.price,
      stock: mugProduct.stock,
      quantity: 2,
    });
    expect(item).not.toHaveProperty("variantSku");
  });

  it("reports the variant's stock, not the product total", async () => {
    const [item] = await loadCartProducts(db, [
      line("runner", 1, "runner-eu42-black"),
    ]);

    // The runner has 9 across all sizes but only 3 in this one.
    expect(runnerProduct.stock).toBe(9);
    expect(item.stock).toBe(3);
    expect(item).toMatchObject({
      variantSku: "runner-eu42-black",
      variantSize: "42",
      variantColor: "Black",
    });
  });

  it("keeps two sizes of the same shoe as two separate lines", async () => {
    const items = await loadCartProducts(db, [
      line("runner", 1, "runner-eu42-black"),
      line("runner", 1, "runner-eu42-white"),
    ]);

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.variantSku)).toEqual([
      "runner-eu42-black",
      "runner-eu42-white",
    ]);
  });

  it("preserves the stored order rather than the order Mongo returns", async () => {
    const items = await loadCartProducts(db, [
      line("pins"),
      line("mug"),
      line("runner", 1, "runner-eu42-black"),
    ]);

    expect(items.map((i) => i.id)).toEqual(["pins", "mug", "runner"]);
  });

  it("drops a line whose product left the catalog", async () => {
    const items = await loadCartProducts(db, [line("ghost"), line("mug")]);

    expect(items.map((i) => i.id)).toEqual(["mug"]);
  });

  it("drops a line whose variant left the catalog", async () => {
    // Priced and shipped by SKU — a SKU that no longer exists can be neither,
    // so showing the line would offer something that cannot be bought.
    const items = await loadCartProducts(db, [
      line("runner", 1, "runner-eu99-black"),
      line("mug"),
    ]);

    expect(items.map((i) => i.id)).toEqual(["mug"]);
  });

  it("drops a variant product carrying no SKU at all", async () => {
    const items = await loadCartProducts(db, [line("runner", 1)]);

    expect(items).toEqual([]);
  });

  it("keeps a sold-out line so the shopper is told, not silently robbed of it", async () => {
    const [item] = await loadCartProducts(db, [
      line("runner", 1, "runner-eu43-black"),
    ]);

    expect(item.stock).toBe(0);
    expect(item.variantSku).toBe("runner-eu43-black");
  });

  it("fetches the catalog once however many lines share a product", async () => {
    // The join is one $in query; a per-line lookup would be four.
    let queries = 0;
    const counting = {
      collection(name: string) {
        const real = (testDb as never as { collection(n: string): unknown }).collection(name);
        return {
          ...(real as object),
          find(...args: unknown[]) {
            queries++;
            return (real as { find(...a: unknown[]): unknown }).find(...args);
          },
        };
      },
    } as never;

    await loadCartProducts(counting, [
      line("runner", 1, "runner-eu42-black"),
      line("runner", 1, "runner-eu42-white"),
      line("mug"),
      line("pins"),
    ]);

    expect(queries).toBe(1);
  });
});

describe("serializeCartProduct", () => {
  it("carries no variant fields for a single-SKU product", async () => {
    const item = serializeCartProduct(mugProduct, line("mug", 3));

    expect(item).toEqual({
      id: "mug",
      name: "Mug",
      price: mugProduct.price,
      description: mugProduct.description,
      imageUrl: mugProduct.imageUrl,
      stock: mugProduct.stock,
      quantity: 3,
    });
  });

  it("never leaks the catalog document's other fields", async () => {
    const item = serializeCartProduct(
      runnerProduct,
      line("runner", 1, "runner-eu42-black")
    );

    expect(item).not.toHaveProperty("_id");
    expect(item).not.toHaveProperty("variants");
  });
});
