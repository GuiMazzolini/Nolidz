// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

const catalog = [runner, mug, soldOut];

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
  /** The runner comes in two colours, so it occupies two of the four tiles. */
  it("renders one card per colourway, alphabetically by default", () => {
    render(<ProductsList products={catalog} />);

    expect(headings()).toEqual([
      "Mug",
      "Pins",
      "Runner – Black",
      "Runner – White",
    ]);
    expect(screen.getByText("4 of 4 items")).toBeVisible();
  });

  it("filters on name and description", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={catalog} />);

    await user.type(screen.getByRole("searchbox"), "ceramic");

    expect(headings()).toEqual(["Mug"]);
    expect(screen.getByText("1 of 4 items")).toBeVisible();
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
    expect(headings()).toHaveLength(4);
  });

  it("sorts by price, keeping a shoe's colourways together", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={catalog} />);

    await user.selectOptions(screen.getByRole("combobox"), "price-asc");
    expect(headings()).toEqual([
      "Pins",
      "Mug",
      "Runner – Black",
      "Runner – White",
    ]);

    await user.selectOptions(screen.getByRole("combobox"), "price-desc");
    expect(headings().slice(2)).toEqual(["Mug", "Pins"]);
  });

  /** Stock sorts on the colourway's own count, which is what its tile shows. */
  it("sorts by stock", async () => {
    const user = userEvent.setup();
    render(<ProductsList products={catalog} />);

    await user.selectOptions(screen.getByRole("combobox"), "stock-desc");
    expect(headings()).toEqual([
      "Mug",
      "Runner – Black",
      "Runner – White",
      "Pins",
    ]);
  });

  it("surfaces a cart error above the grid", () => {
    useCartStore.setState({ cartError: "Not enough stock for that quantity." });
    render(<ProductsList products={catalog} />);

    expect(
      screen.getByText("Not enough stock for that quantity.")
    ).toBeVisible();
  });
});
