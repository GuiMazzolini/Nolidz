// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/app/lib/money";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { startCheckoutMock } = vi.hoisted(() => ({ startCheckoutMock: vi.fn() }));

vi.mock("@/app/lib/use-checkout", () => ({
  useCheckout: () => ({
    startCheckout: startCheckoutMock,
    loading: false,
    error: null,
    clearError: () => {},
  }),
}));

import ProductDetail from "@/app/products/[id]/ProductDetail";
import { useCartStore } from "@/app/lib/store/cartStore";
import type { Product } from "@/app/product-data";

const runner: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe",
  imageUrl: "/runner.png",
  price: 89.99,
  stock: 9,
  variants: [
    { sku: "runner-eu42-black", size: "42", color: "Black", stock: 3 },
    { sku: "runner-eu43-black", size: "43", color: "Black", stock: 0 },
    { sku: "runner-eu41-white", size: "41", color: "White", stock: 2, price: 109.99 },
    { sku: "runner-eu42-white", size: "42", color: "White", stock: 0 },
  ],
};

const mug: Product = {
  id: "mug",
  name: "Mug",
  description: "A mug",
  imageUrl: "/mug.png",
  price: 14.99,
  stock: 8,
};

/** Accessible-name matching on `name` is a full-string match by default. */
function sizeButton(size: string) {
  return screen.getByRole("button", { name: size });
}

beforeEach(() => {
  vi.clearAllMocks();
  useCartStore.setState({
    cartProducts: [],
    guestCart: [],
    isAuthenticated: false,
    loading: {},
    cartError: null,
  });
});

describe("variant selection", () => {
  it("opens on the first colour with stock and asks for a size", () => {
    render(<ProductDetail product={runner} />);

    expect(screen.getByText(/Colour:/)).toHaveTextContent("Black");
    expect(
      screen.getByRole("button", { name: /Select a Size/i })
    ).toBeDisabled();
    expect(screen.getByText(/Select a size to see availability/i)).toBeVisible();
  });

  it("hides a sold-out size and shows one with stock", () => {
    render(<ProductDetail product={runner} />);

    expect(sizeButton("42")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "43" })).toBeNull();
  });

  it("shows the count for the chosen size, not the product total", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={runner} />);

    await user.click(sizeButton("42"));

    // The product totals 9 units; EU 42 Black holds 3.
    expect(screen.getByText("Only 3 left in EU 42")).toBeVisible();
    expect(screen.queryByText(/9 in stock/)).toBeNull();
  });

  it("swaps the size run when the colour changes and clears the selection", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={runner} />);

    await user.click(sizeButton("42"));
    await user.click(screen.getByRole("button", { name: /^White/ }));

    // White only has EU 41 in stock; sold-out 42 is hidden, and the
    // previously chosen size is deselected.
    expect(sizeButton("41")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "42" })).toBeNull();
    expect(screen.queryByRole("button", { name: "43" })).toBeNull();
    expect(screen.getByRole("button", { name: /Select a Size/i })).toBeDisabled();
  });

  it("shows the chosen colour's price", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={runner} />);

    expect(screen.getByText(formatMoney(89.99))).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^White/ }));
    expect(screen.getByText(formatMoney(109.99))).toBeVisible();
  });

  it("hides a fully sold-out colourway from the picker", () => {
    render(
      <ProductDetail
        product={{
          ...runner,
          variants: [
            { sku: "a", size: "42", color: "Black", stock: 1 },
            { sku: "b", size: "42", color: "White", stock: 0 },
          ],
        }}
      />
    );

    expect(screen.queryByRole("button", { name: /White/ })).toBeNull();
    expect(screen.queryByText("Colour:")).toBeNull();
  });
});

describe("adding a variant to the cart", () => {
  it("adds the exact size and colour chosen", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={runner} />);

    await user.click(sizeButton("42"));
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(useCartStore.getState().cartProducts).toEqual([
      expect.objectContaining({
        id: "runner",
        variantSku: "runner-eu42-black",
        variantSize: "42",
        variantColor: "Black",
        stock: 3,
        quantity: 1,
      }),
    ]);
  });

  it("adds a second size as its own line", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={runner} />);

    await user.click(sizeButton("42"));
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    await user.click(screen.getByRole("button", { name: /^White/ }));
    await user.click(sizeButton("41"));
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(
      useCartStore.getState().cartProducts.map((p) => p.variantSku)
    ).toEqual(["runner-eu42-black", "runner-eu41-white"]);
  });

  it("switches to Remove for the size in the cart, and back for another", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={runner} />);

    await user.click(sizeButton("42"));
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    expect(screen.getByRole("button", { name: "Remove from Cart" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^White/ }));
    await user.click(sizeButton("41"));
    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeVisible();
  });

  it("removes only the selected size", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={runner} />);

    await user.click(sizeButton("42"));
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    await user.click(screen.getByRole("button", { name: "Remove from Cart" }));

    expect(useCartStore.getState().cartProducts).toEqual([]);
  });

  it("blocks Buy Now until a size is chosen", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={runner} />);

    expect(screen.getByRole("button", { name: "Buy Now" })).toBeDisabled();

    await user.click(sizeButton("42"));
    await user.click(screen.getByRole("button", { name: "Buy Now" }));

    expect(startCheckoutMock).toHaveBeenCalledOnce();
    expect(useCartStore.getState().cartProducts[0].variantSku).toBe(
      "runner-eu42-black"
    );
  });
});

describe("a product with every size sold out", () => {
  const soldOut: Product = {
    ...runner,
    stock: 0,
    variants: runner.variants!.map((v) => ({ ...v, stock: 0 })),
  };

  it("says so, hides the pickers, and disables both actions", () => {
    render(<ProductDetail product={soldOut} />);

    expect(screen.getByText("Out of stock in every size")).toBeVisible();
    expect(screen.queryByText("EU size")).toBeNull();
    expect(screen.queryByText("Colour:")).toBeNull();
    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buy Now" })).toBeDisabled();
  });
});

describe("a single-SKU product", () => {
  it("adds straight to the cart with no size picker", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={mug} />);

    expect(screen.queryByText("EU size")).toBeNull();
    expect(screen.getByText("8 in stock")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    const [line] = useCartStore.getState().cartProducts;
    expect(line.id).toBe("mug");
    expect(line.variantSku).toBeUndefined();
  });

  it("disables adding when out of stock", () => {
    render(<ProductDetail product={{ ...mug, stock: 0 }} />);
    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
  });
});

describe("the photo gallery", () => {
  const withPhotos: Product = {
    ...runner,
    images: ["/sole.png", "/detail.png"],
    colorImages: [
      { color: "Black", imageUrl: "/runner-black.png" },
      { color: "White", imageUrl: "/runner-white.png" },
    ],
  };

  function hero(): HTMLImageElement {
    return screen.getByAltText(/^Runner in /) as HTMLImageElement;
  }

  it("leads with the colourway photo and follows with the extra shots", () => {
    render(<ProductDetail product={withPhotos} initialColor="Black" />);

    expect(hero().src).toContain("runner-black.png");
    expect(
      screen.getByRole("button", { name: "Show photo 3 of 3" })
    ).toBeInTheDocument();
  });

  /**
   * Switching colourway must not leave the shopper on the third photo of the
   * shoe they just navigated away from.
   */
  it("returns to the hero when the colourway changes", async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={withPhotos} initialColor="Black" />);

    await user.click(screen.getByRole("button", { name: "Show photo 2 of 3" }));
    expect(hero().src).toContain("sole.png");

    await user.click(screen.getByRole("button", { name: "White" }));

    expect(hero().src).toContain("runner-white.png");
  });

  it("shows no gallery controls for a product with one photo", () => {
    render(<ProductDetail product={mug} />);

    expect(screen.getByAltText("Mug")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next photo" })).toBeNull();
  });
});
