// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { startCheckoutMock, useSessionMock } = vi.hoisted(() => ({
  startCheckoutMock: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ useSession: useSessionMock }));

vi.mock("@/app/lib/use-checkout", () => ({
  useCheckout: () => ({
    startCheckout: startCheckoutMock,
    loading: false,
    error: null,
    clearError: () => {},
  }),
}));

import ShoppingCartList from "@/app/cart/ShoppingCartList";
import { useCartStore } from "@/app/lib/store/cartStore";
import type { Product } from "@/app/product-data";

const black42: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe",
  imageUrl: "/runner.png",
  price: 20,
  stock: 3,
  quantity: 1,
  variantSku: "runner-eu42-black",
  variantSize: "42",
  variantColor: "Black",
};

const white43: Product = {
  ...black42,
  quantity: 2,
  stock: 5,
  variantSku: "runner-eu43-white",
  variantSize: "43",
  variantColor: "White",
};

beforeEach(() => {
  vi.clearAllMocks();
  useSessionMock.mockReturnValue({ status: "authenticated" });
  useCartStore.setState({
    cartProducts: [],
    guestCart: [],
    isAuthenticated: true,
    loading: {},
    cartError: null,
  });
});

describe("ShoppingCartList", () => {
  it("renders one row per size, each with its own label", () => {
    render(<ShoppingCartList initialCartProducts={[black42, white43]} />);

    expect(screen.getByText("EU 42 · Black")).toBeVisible();
    expect(screen.getByText("EU 43 · White")).toBeVisible();
    expect(screen.getAllByRole("heading", { name: "Runner" })).toHaveLength(2);
  });

  it("totals across sizes and waives shipping over the threshold", () => {
    render(<ShoppingCartList initialCartProducts={[black42, white43]} />);

    // 1 × $20 + 2 × $20 = $60, over the $50 free-shipping threshold, so
    // subtotal and total are both $60 and shipping is free.
    expect(screen.getByText("Subtotal (3 items)")).toBeVisible();
    expect(screen.getAllByText("$60.00")).toHaveLength(2);
    expect(screen.getByText("FREE")).toBeVisible();
  });

  it("charges shipping and nudges toward the threshold on a small cart", () => {
    render(<ShoppingCartList initialCartProducts={[black42]} />);

    expect(screen.getByText("$5.00")).toBeVisible();
    expect(screen.getByText(/Add \$30\.00 more for free shipping/)).toBeVisible();
  });

  it("tells the shopper the basket does not hold their size", () => {
    useCartStore.setState({ cartProducts: [black42] });
    render(<ShoppingCartList initialCartProducts={[black42]} />);

    expect(
      screen.getByText(/basket doesn't hold them/i)
    ).toBeVisible();
  });

  it("shows the empty state with nothing in the cart", () => {
    render(<ShoppingCartList initialCartProducts={[]} />);

    expect(screen.getByText("Your cart is empty")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Pay with Stripe/ })).toBeNull();
  });

  it("starts checkout from the summary", async () => {
    const user = userEvent.setup();
    render(<ShoppingCartList initialCartProducts={[black42]} />);

    await user.click(screen.getByRole("button", { name: /Pay with Stripe/ }));
    expect(startCheckoutMock).toHaveBeenCalledOnce();
  });

  it("prompts a guest to log in but still lets them check out", () => {
    useSessionMock.mockReturnValue({ status: "unauthenticated" });
    useCartStore.setState({ isAuthenticated: false, cartProducts: [black42] });

    render(<ShoppingCartList initialCartProducts={[]} />);

    expect(screen.getByText(/shopping as a guest/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /Pay with Stripe/ })).toBeEnabled();
  });

  it("adopts the server snapshot for a signed-in visitor", () => {
    // The store starts empty on first paint; the server's cart must win.
    render(<ShoppingCartList initialCartProducts={[black42, white43]} />);
    expect(useCartStore.getState().cartProducts).toHaveLength(2);
  });

  it("surfaces a cart error banner", () => {
    useCartStore.setState({ cartError: "Not enough stock for that quantity." });
    render(<ShoppingCartList initialCartProducts={[black42]} />);

    expect(
      screen.getByText("Not enough stock for that quantity.")
    ).toBeVisible();
  });
});
