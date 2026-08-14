// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CartItem from "@/app/components/CartItem";
import { useCartStore } from "@/app/lib/store/cartStore";
import type { Product } from "@/app/product-data";

const line: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe",
  imageUrl: "/runner.png",
  price: 89.99,
  stock: 3,
  quantity: 2,
  variantSku: "runner-eu42-black",
  variantSize: "42",
  variantColor: "Black",
};

const updateQuantity = vi.fn();
const removeFromCart = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useCartStore.setState({
    cartProducts: [],
    loading: {},
    updateQuantity,
    removeFromCart,
  } as never);
});

describe("CartItem", () => {
  it("labels the line with its EU size and colour", () => {
    render(<CartItem product={line} />);
    expect(screen.getByText("EU 42 · Black")).toBeVisible();
  });

  it("shows no variant label for a single-SKU product", () => {
    render(
      <CartItem
        product={{ ...line, variantSku: undefined, variantSize: undefined, variantColor: undefined }}
      />
    );
    expect(screen.queryByText(/EU /)).toBeNull();
  });

  it("prices the line by quantity and shows the unit price", () => {
    render(<CartItem product={line} />);
    expect(screen.getByText(/179\.98/)).toBeVisible();
    expect(screen.getByText(/89\.99 each/)).toBeVisible();
  });

  it("sends the SKU when changing quantity", async () => {
    const user = userEvent.setup();
    render(<CartItem product={line} />);

    await user.click(screen.getByLabelText("Increase quantity"));
    expect(updateQuantity).toHaveBeenCalledWith("runner", 3, "runner-eu42-black");

    await user.click(screen.getByLabelText("Decrease quantity"));
    expect(updateQuantity).toHaveBeenCalledWith("runner", 1, "runner-eu42-black");
  });

  it("turns the decrement into a remove at quantity 1", async () => {
    const user = userEvent.setup();
    render(<CartItem product={{ ...line, quantity: 1 }} />);

    expect(screen.queryByLabelText("Decrease quantity")).toBeNull();
    await user.click(screen.getByLabelText("Remove from cart"));

    expect(removeFromCart).toHaveBeenCalledWith("runner", "runner-eu42-black");
  });

  it("caps the increment at that variant's stock", () => {
    render(<CartItem product={{ ...line, quantity: 3 }} />);
    expect(screen.getByLabelText("Increase quantity")).toBeDisabled();
  });

  it("reports availability from the variant, not the product", () => {
    render(<CartItem product={line} />);
    expect(screen.getByText("3 available")).toBeVisible();
  });

  it("flags a line whose variant sold out", () => {
    render(<CartItem product={{ ...line, stock: 0 }} />);
    expect(screen.getByText("Out of stock")).toBeVisible();
  });

  it("disables the controls while that line is in flight", () => {
    useCartStore.setState({
      loading: { "runner::runner-eu42-black": true },
    } as never);

    render(<CartItem product={line} />);
    expect(screen.getByLabelText("Increase quantity")).toBeDisabled();
    expect(screen.getByLabelText("Decrease quantity")).toBeDisabled();
  });

  it("stays interactive while a different size is in flight", () => {
    useCartStore.setState({
      loading: { "runner::runner-eu43-black": true },
    } as never);

    render(<CartItem product={line} />);
    expect(screen.getByLabelText("Increase quantity")).toBeEnabled();
  });
});
