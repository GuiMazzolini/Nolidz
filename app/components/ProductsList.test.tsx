// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductsList from "@/app/components/ProductsList";
import { useCartStore } from "@/app/lib/store/cartStore";
import type { Product } from "@/app/product-data";

const runner: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe with laces",
  imageUrl: "/runner.png",
  price: 89.99,
  stock: 5,
  variants: [
    { sku: "runner-eu42-black", size: "42", color: "Black", stock: 3 },
    { sku: "runner-eu43-black", size: "43", color: "Black", stock: 0 },
    { sku: "runner-eu42-white", size: "42", color: "White", stock: 2 },
  ],
};

const mug: Product = {
  id: "mug",
  name: "Mug",
  description: "A ceramic mug",
  imageUrl: "/mug.png",
  price: 14.99,
  stock: 4,
};

const soldOut: Product = {
  id: "pins",
  name: "Pins",
  description: "Enamel pins",
  imageUrl: "/pins.png",
  price: 12.99,
  stock: 0,
};

/** The card is the region containing the product's heading. */
function card(name: string) {
  return screen.getByRole("heading", { name }).closest(".group") as HTMLElement;
}

beforeEach(() => {
  useCartStore.setState({
    cartProducts: [],
    guestCart: [],
    isAuthenticated: false,
    loading: {},
    cartError: null,
  });
});

describe("catalog cards for variant products", () => {
  it("links to the product page instead of adding inline", () => {
    render(<ProductsList products={[runner]} />);

    const choose = within(card("Runner")).getByRole("link", {
      name: /Choose Size/i,
    });
    expect(choose).toHaveAttribute("href", "/products/runner");
    expect(
      within(card("Runner")).queryByRole("button", { name: /Add to Cart/i })
    ).toBeNull();
  });

  it("shows the buyable size range and the colourways", () => {
    // EU 43 is sold out, so the advertised range stops at the size you can buy.
    render(<ProductsList products={[runner]} />);

    const region = card("Runner");
    expect(within(region).getByText("EU 42")).toBeVisible();
    expect(within(region).getByText("Black")).toBeVisible();
    expect(within(region).getByText("White")).toBeVisible();
  });

  it("spans the range when several sizes are buyable", () => {
    render(
      <ProductsList
        products={[
          {
            ...runner,
            variants: [
              { sku: "a", size: "40", color: "Black", stock: 2 },
              { sku: "b", size: "42", color: "Black", stock: 1 },
              { sku: "c", size: "45", color: "Black", stock: 3 },
            ],
          },
        ]}
      />
    );

    expect(within(card("Runner")).getByText("EU 40–45")).toBeVisible();
  });

  it("drops the EU prefix for a product that is not numerically sized", () => {
    render(
      <ProductsList
        products={[
          {
            ...mug,
            variants: [
              { sku: "a", size: "One size", color: "Matte Black", stock: 4 },
              { sku: "b", size: "One size", color: "Cream", stock: 2 },
            ],
          },
        ]}
      />
    );

    const region = card("Mug");
    expect(within(region).getByText("One size")).toBeVisible();
    expect(within(region).queryByText(/EU/)).toBeNull();
  });

  it("summarises the overflow past three colourways", () => {
    render(
      <ProductsList
        products={[
          {
            ...runner,
            variants: ["Black", "White", "Sand", "Olive", "Red"].map(
              (color, i) => ({
                sku: `sku-${i}`,
                size: "42",
                color,
                stock: 2,
              })
            ),
          },
        ]}
      />
    );

    expect(within(card("Runner")).getByText("+2")).toBeVisible();
  });

  it("shows how many units of the product are already in the cart", () => {
    useCartStore.setState({
      cartProducts: [
        { ...runner, quantity: 1, variantSku: "runner-eu42-black" },
        { ...runner, quantity: 2, variantSku: "runner-eu42-white" },
      ],
    });

    render(<ProductsList products={[runner]} />);
    expect(
      within(card("Runner")).getByRole("link", { name: /In cart \(3\)/ })
    ).toBeVisible();
  });

  it("marks a fully sold-out variant product", () => {
    render(<ProductsList products={[{ ...runner, stock: 0 }]} />);

    const region = card("Runner");
    expect(within(region).getByText("Out of stock")).toBeVisible();
    expect(within(region).getByRole("link", { name: "Out of Stock" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });
});

describe("catalog cards for single-SKU products", () => {
  it("adds straight to the cart and switches to a stepper", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={[mug]} />);

    await user.click(within(card("Mug")).getByRole("button", { name: "Add to Cart" }));

    expect(useCartStore.getState().cartProducts[0].id).toBe("mug");
    expect(within(card("Mug")).getByText("1")).toBeVisible();
  });

  it("disables the button when out of stock", () => {
    render(<ProductsList products={[soldOut]} />);
    expect(
      within(card("Pins")).getByRole("button", { name: "Out of Stock" })
    ).toBeDisabled();
  });

  it("does not treat a variant line as this product's cart entry", () => {
    // A cart holding sized lines must not put an unrelated card into stepper mode.
    useCartStore.setState({
      cartProducts: [{ ...runner, quantity: 1, variantSku: "runner-eu42-black" }],
    });

    render(<ProductsList products={[runner, mug]} />);
    expect(within(card("Mug")).getByRole("button", { name: "Add to Cart" })).toBeVisible();
  });
});

describe("search and sort", () => {
  it("filters on name and description", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={[runner, mug, soldOut]} />);

    await user.type(screen.getByRole("searchbox"), "ceramic");

    expect(screen.getByRole("heading", { name: "Mug" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Runner" })).toBeNull();
    expect(screen.getByText("1 of 3 products")).toBeVisible();
  });

  it("offers a reset when nothing matches", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={[runner, mug]} />);

    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText("No products match")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("heading", { name: "Runner" })).toBeVisible();
  });

  it("sorts by price", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={[runner, mug, soldOut]} />);

    await user.selectOptions(screen.getByRole("combobox"), "price-asc");

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((node) => node.textContent);
    expect(headings).toEqual(["Pins", "Mug", "Runner"]);
  });
});
