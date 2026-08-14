// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  addCartItemMock,
  updateCartQuantityMock,
  removeCartItemMock,
  fetchCartItemsMock,
  mergeGuestCartMock,
} = vi.hoisted(() => ({
  addCartItemMock: vi.fn(),
  updateCartQuantityMock: vi.fn(),
  removeCartItemMock: vi.fn(),
  fetchCartItemsMock: vi.fn(),
  mergeGuestCartMock: vi.fn(),
}));

vi.mock("@/app/lib/api/cart", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api/cart")>(
    "@/app/lib/api/cart"
  );
  return {
    CartRequestError: actual.CartRequestError,
    addCartItem: addCartItemMock,
    updateCartQuantity: updateCartQuantityMock,
    removeCartItem: removeCartItemMock,
    fetchCartItems: fetchCartItemsMock,
    mergeGuestCart: mergeGuestCartMock,
  };
});

import { CartRequestError } from "@/app/lib/api/cart";
import { useCartStore } from "@/app/lib/store/cartStore";
import type { Product } from "@/app/product-data";

const black42: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe",
  imageUrl: "/runner.png",
  price: 89.99,
  stock: 3,
  variantSku: "runner-eu42-black",
  variantSize: "42",
  variantColor: "Black",
};

const white42: Product = {
  ...black42,
  stock: 6,
  variantSku: "runner-eu42-white",
  variantColor: "White",
};

const mug: Product = {
  id: "mug",
  name: "Mug",
  description: "A mug",
  imageUrl: "/mug.png",
  price: 14.99,
  stock: 2,
};

function reset(isAuthenticated = false) {
  useCartStore.setState({
    cartProducts: [],
    guestCart: [],
    isAuthenticated,
    loading: {},
    cartError: null,
  });
}

const store = () => useCartStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe("guest cart", () => {
  it("keeps two sizes of one product as separate lines", async () => {
    await store().addToCart(black42);
    await store().addToCart(white42);

    expect(store().cartProducts).toHaveLength(2);
    expect(store().getTotalItems()).toBe(2);
  });

  it("increments the matching size rather than adding a second line", async () => {
    await store().addToCart(black42);
    await store().addToCart(black42);

    expect(store().cartProducts).toHaveLength(1);
    expect(store().cartProducts[0].quantity).toBe(2);
  });

  it("stops at that size's stock", async () => {
    for (let i = 0; i < 5; i++) {
      await store().addToCart(black42);
    }

    expect(store().cartProducts[0].quantity).toBe(3);
    expect(store().cartError).toBe("Only 3 in stock.");
  });

  it("refuses a sold-out variant", async () => {
    await store().addToCart({ ...black42, stock: 0 });

    expect(store().cartProducts).toEqual([]);
    expect(store().cartError).toBe("This product is out of stock.");
  });

  it("updates only the size named", async () => {
    await store().addToCart(black42);
    await store().addToCart(white42);

    await store().updateQuantity("runner", 4, "runner-eu42-white");

    const quantities = Object.fromEntries(
      store().cartProducts.map((p) => [p.variantSku, p.quantity])
    );
    expect(quantities).toEqual({
      "runner-eu42-black": 1,
      "runner-eu42-white": 4,
    });
  });

  it("clamps an over-stock update and reports it", async () => {
    await store().addToCart(black42);
    await store().updateQuantity("runner", 9, "runner-eu42-black");

    expect(store().cartProducts[0].quantity).toBe(3);
    expect(store().cartError).toBe("Only 3 in stock.");
  });

  it("drops the line at quantity 0", async () => {
    await store().addToCart(black42);
    await store().addToCart(white42);

    await store().updateQuantity("runner", 0, "runner-eu42-black");

    expect(store().cartProducts).toHaveLength(1);
    expect(store().cartProducts[0].variantSku).toBe("runner-eu42-white");
  });

  it("removes one size and leaves the other", async () => {
    await store().addToCart(black42);
    await store().addToCart(white42);

    await store().removeFromCart("runner", "runner-eu42-black");

    expect(store().cartProducts.map((p) => p.variantSku)).toEqual([
      "runner-eu42-white",
    ]);
  });

  it("never touches a variant line when removing a single-SKU product", async () => {
    await store().addToCart(black42);
    await store().addToCart(mug);

    await store().removeFromCart("mug");

    expect(store().cartProducts).toHaveLength(1);
    expect(store().cartProducts[0].variantSku).toBe("runner-eu42-black");
  });

  it("totals the subtotal across sizes", async () => {
    await store().addToCart(black42);
    await store().addToCart(white42);
    await store().updateQuantity("runner", 2, "runner-eu42-white");

    expect(store().getSubtotal()).toBeCloseTo(89.99 * 3);
    expect(store().getTotalItems()).toBe(3);
  });

  it("never calls the server while signed out", async () => {
    await store().addToCart(black42);
    await store().updateQuantity("runner", 2, "runner-eu42-black");
    await store().removeFromCart("runner", "runner-eu42-black");

    expect(addCartItemMock).not.toHaveBeenCalled();
    expect(updateCartQuantityMock).not.toHaveBeenCalled();
    expect(removeCartItemMock).not.toHaveBeenCalled();
  });
});

describe("authenticated cart", () => {
  beforeEach(() => reset(true));

  it("sends the SKU with every mutation", async () => {
    addCartItemMock.mockResolvedValue([{ ...black42, quantity: 1 }]);
    updateCartQuantityMock.mockResolvedValue([{ ...black42, quantity: 2 }]);
    removeCartItemMock.mockResolvedValue([]);

    await store().addToCart(black42);
    await store().updateQuantity("runner", 2, "runner-eu42-black");
    await store().removeFromCart("runner", "runner-eu42-black");

    expect(addCartItemMock).toHaveBeenCalledWith("runner", "runner-eu42-black");
    expect(updateCartQuantityMock).toHaveBeenCalledWith(
      "runner",
      2,
      "runner-eu42-black"
    );
    expect(removeCartItemMock).toHaveBeenCalledWith("runner", "runner-eu42-black");
  });

  it("omits the SKU for a single-SKU product", async () => {
    addCartItemMock.mockResolvedValue([{ ...mug, quantity: 1 }]);
    await store().addToCart(mug);
    expect(addCartItemMock).toHaveBeenCalledWith("mug", undefined);
  });

  it("marks only the affected line as loading", async () => {
    let release: (value: unknown) => void = () => {};
    addCartItemMock.mockReturnValue(new Promise((resolve) => (release = resolve)));

    const pending = store().addToCart(black42);

    expect(store().isLoading("runner", "runner-eu42-black")).toBe(true);
    expect(store().isLoading("runner", "runner-eu42-white")).toBe(false);
    expect(store().isLoading("runner")).toBe(false);

    release([]);
    await pending;
    expect(store().isLoading("runner", "runner-eu42-black")).toBe(false);
  });

  it("explains a 409 as a stock problem and a 401 as a sign-in problem", async () => {
    addCartItemMock.mockRejectedValueOnce(new CartRequestError(409));
    await store().addToCart(black42);
    expect(store().cartError).toBe("Not enough stock for that quantity.");

    addCartItemMock.mockRejectedValueOnce(new CartRequestError(401));
    await store().addToCart(black42);
    expect(store().cartError).toBe("Please sign in to update your cart.");
  });

  it("keeps the cart intact when the server call fails", async () => {
    const serverCart = [{ ...black42, quantity: 1 }];
    useCartStore.setState({ cartProducts: serverCart });
    removeCartItemMock.mockRejectedValueOnce(new Error("network"));

    await store().removeFromCart("runner", "runner-eu42-black");

    expect(store().cartProducts).toEqual(serverCart);
    expect(store().cartError).toBe("Could not update your cart. Please try again.");
  });
});

describe("sign-in merge", () => {
  it("sends every guest line, SKUs included, and adopts the merged cart", async () => {
    await store().addToCart(black42);
    await store().addToCart(white42);
    await store().addToCart(mug);

    const merged = [{ ...black42, quantity: 1 }];
    mergeGuestCartMock.mockResolvedValue(merged);

    await store().setAuthenticated(true);

    expect(mergeGuestCartMock).toHaveBeenCalledWith([
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-black" },
      { productId: "runner", quantity: 1, variantSku: "runner-eu42-white" },
      { productId: "mug", quantity: 1 },
    ]);
    expect(store().cartProducts).toEqual(merged);
    expect(store().guestCart).toEqual([]);
  });

  it("falls back to fetching the saved cart when the merge fails", async () => {
    await store().addToCart(mug);
    mergeGuestCartMock.mockRejectedValue(new Error("offline"));
    fetchCartItemsMock.mockResolvedValue([{ ...mug, quantity: 5 }]);

    await store().setAuthenticated(true);

    expect(fetchCartItemsMock).toHaveBeenCalled();
    expect(store().cartProducts[0].quantity).toBe(5);
  });

  it("restores the guest cart on sign-out", async () => {
    await store().addToCart(black42);
    const guestCart = store().guestCart;

    useCartStore.setState({ isAuthenticated: true, cartProducts: [] });
    await store().setAuthenticated(false);

    expect(store().cartProducts).toEqual(guestCart);
  });
});
