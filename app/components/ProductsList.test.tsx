// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import ProductsList from "@/app/components/ProductsList";
import { useCartStore } from "@/app/lib/store/cartStore";
import type { Product } from "@/app/product-data";

/** Card behaviour lives in ProductCard.test.tsx; this covers the grid itself. */

const runner: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe with laces",
  imageUrl: "/runner.png",
  price: 89.99,
  stock: 5,
  variants: [
    { sku: "runner-eu42-black", size: "42", color: "Black", stock: 3 },
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

const trail: Product = {
  id: "trail",
  name: "Trail",
  description: "A boot for mud",
  imageUrl: "/trail.png",
  price: 89.99,
  stock: 4,
  variants: [
    { sku: "trail-eu42-olive", size: "42", color: "Olive", stock: 8 },
    { sku: "trail-eu42-grey", size: "42", color: "Grey", stock: 1 },
  ],
};

const catalog = [runner, mug, soldOut, trail];

/** Full card titles, "Runner – Black" included, in grid order. */
function headings() {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((node) => node.textContent!.replace(/\s+/g, " ").trim());
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

describe("the catalog grid", () => {
  /**
   * One tile per colourway, spread so a first pass is one colour of each
   * shoe. Runner and Trail would otherwise occupy the first four tiles
   * as two pairs of siblings.
   */
  it("renders one card per colourway, spreading siblings by default", () => {
    render(<ProductsList products={catalog} />);

    expect(headings()).toEqual([
      "Mug",
      "Runner – Black",
      "Trail – Olive",
      "Runner – White",
      "Trail – Grey",
    ]);
    expect(screen.getByText("5 of 5 items")).toBeVisible();
  });

  it("filters on name and description", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={catalog} />);

    await user.type(screen.getByRole("searchbox"), "ceramic");

    expect(headings()).toEqual(["Mug"]);
    expect(screen.getByText("1 of 5 items")).toBeVisible();
  });

  /** Searching a colour returns that pair, not every colourway of the shoe. */
  it("filters on colour", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={catalog} />);

    await user.type(screen.getByRole("searchbox"), "white");

    expect(headings()).toEqual(["Runner – White"]);
  });

  it("offers a reset when nothing matches", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={catalog} />);

    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText("No products match")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(headings()).toHaveLength(5);
  });

  it("sorts by price, still spreading a shoe's colourways", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={catalog} />);

    await user.selectOptions(screen.getByRole("combobox"), "price-asc");
    expect(headings()).toEqual([
      "Mug",
      "Runner – Black",
      "Trail – Olive",
      "Runner – White",
      "Trail – Grey",
    ]);

    await user.selectOptions(screen.getByRole("combobox"), "price-desc");
    expect(headings()).toEqual([
      "Runner – Black",
      "Trail – Olive",
      "Runner – White",
      "Trail – Grey",
      "Mug",
    ]);
  });

  /** Stock sorts on the colourway's own count, which is what its tile shows. */
  it("sorts by stock", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={catalog} />);

    await user.selectOptions(screen.getByRole("combobox"), "stock-desc");
    expect(headings()).toEqual([
      "Trail – Olive",
      "Mug",
      "Runner – Black",
      "Runner – White",
      "Trail – Grey",
    ]);
  });

  it("ranks a premium colour with other expensive tiles, not its sibling", async () => {
    const user = userEvent.setup();
    const premium: Product = {
      ...runner,
      variants: runner.variants!.map((variant) =>
        variant.color === "White" ? { ...variant, price: 129.99 } : variant
      ),
    };
    render(<ProductsList products={[premium, mug, soldOut, trail]} />);

    await user.selectOptions(screen.getByRole("combobox"), "price-asc");
    expect(headings()).toEqual([
      "Mug",
      "Runner – Black",
      "Trail – Olive",
      "Trail – Grey",
      "Runner – White",
    ]);
  });

  it("hides fully sold-out products from the grid", () => {
    render(<ProductsList products={catalog} />);

    expect(screen.queryByRole("heading", { name: "Pins" })).toBeNull();
  });

  it("surfaces a cart error above the grid", () => {
    useCartStore.setState({ cartError: "Not enough stock for that quantity." });
    render(<ProductsList products={catalog} />);

    expect(
      screen.getByText("Not enough stock for that quantity.")
    ).toBeVisible();
  });
});
