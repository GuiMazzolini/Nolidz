import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCartItem,
  CartRequestError,
  fetchCartItems,
  mergeGuestCart,
  removeCartItem,
  updateCartQuantity,
} from "@/app/lib/api/cart";

const fetchMock = vi.fn();

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    url: url as string,
    method: (init as RequestInit).method,
    credentials: (init as RequestInit).credentials,
    body: (init as RequestInit).body
      ? JSON.parse((init as RequestInit).body as string)
      : undefined,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal("fetch", fetchMock);
});

describe("cart API client", () => {
  it("sends the SKU when adding a variant and omits it otherwise", async () => {
    await addCartItem("runner", "runner-eu42-black");
    expect(lastCall()).toMatchObject({
      url: "/api/cart",
      method: "POST",
      body: { productId: "runner", variantSku: "runner-eu42-black" },
    });

    await addCartItem("mug");
    expect(lastCall().body).toEqual({ productId: "mug" });
  });

  it("sends quantity updates with the SKU", async () => {
    await updateCartQuantity("runner", 3, "runner-eu42-black");
    expect(lastCall()).toMatchObject({
      method: "PATCH",
      body: { productId: "runner", quantity: 3, variantSku: "runner-eu42-black" },
    });
  });

  it("sends removals with the SKU", async () => {
    await removeCartItem("runner", "runner-eu42-black");
    expect(lastCall()).toMatchObject({
      method: "DELETE",
      body: { productId: "runner", variantSku: "runner-eu42-black" },
    });
  });

  it("reads the cart with no body", async () => {
    await fetchCartItems();
    expect(lastCall()).toMatchObject({ method: "GET", body: undefined });
  });

  it("posts the guest cart to the merge endpoint", async () => {
    const items = [
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
    ];
    await mergeGuestCart(items);

    expect(lastCall()).toMatchObject({
      url: "/api/cart/merge",
      method: "POST",
      body: { items },
    });
  });

  it("always sends credentials, so the session cookie rides along", async () => {
    await fetchCartItems();
    expect(lastCall().credentials).toBe("include");
  });

  it("throws a typed error carrying the status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({}) });

    await expect(addCartItem("runner", "runner-eu42-black")).rejects.toBeInstanceOf(
      CartRequestError
    );
    await expect(addCartItem("runner")).rejects.toMatchObject({ status: 409 });
  });
});
