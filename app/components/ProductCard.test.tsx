// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductCard from "@/app/components/ProductCard";
import { useCartStore } from "@/app/lib/store/cartStore";
import type { Product } from "@/app/product-data";

/**
 * The banner is revealed with `group-hover` CSS, which jsdom does not evaluate.
 * These tests cover the behaviour behind it — which photo, which sizes, which
 * colour the card is presenting — not the visual reveal itself.
 */

const runner: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe",
  imageUrl: "/runner-black.png",
  price: 89.99,
  stock: 9,
  variants: [
    { sku: "r-42-black", size: "42", color: "Black", stock: 3 },
    { sku: "r-43-black", size: "43", color: "Black", stock: 2 },
    { sku: "r-44-black", size: "44", color: "Black", stock: 1 },
    { sku: "r-45-black", size: "45", color: "Black", stock: 4 },
    { sku: "r-42-white", size: "42", color: "White", stock: 5 },
  ],
  colorImages: [
    { color: "Black", imageUrl: "/runner-black.png" },
    { color: "White", imageUrl: "/runner-white.png" },
  ],
};

const mug: Product = {
  id: "mug",
  name: "Mug",
  description: "A mug",
  imageUrl: "/mug.png",
  price: 14.99,
  stock: 4,
};

function hero() {
  return screen.getByAltText(/^Runner in/) as HTMLImageElement;
}

/** Swatches are hidden from assistive tech, so they are found by their data hook. */
function swatch(color: string): HTMLElement {
  const node = document.querySelector(`[data-color="${color}"]`);
  if (!node) throw new Error(`no swatch for ${color}`);
  return node as HTMLElement;
}

function swatchCount() {
  return document.querySelectorAll("[data-color]").length;
}

/** next/image rewrites src; the filename is what identifies the photo. */
function photoName(img: HTMLElement) {
  return decodeURIComponent((img as HTMLImageElement).src).split("/").pop();
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

describe("the colour swatch banner", () => {
  it("rests on the first colourway, naming it after the product", () => {
    render(<ProductCard product={runner} />);

    expect(
      screen.getByRole("heading", { name: /Runner\s+–\s+Black/ })
    ).toBeVisible();
    expect(photoName(hero())).toBe("runner-black.png");
  });

  it("swaps the main photo and the name when a swatch is hovered", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={runner} />);

    await user.hover(swatch("White"));

    expect(photoName(hero())).toBe("runner-white.png");
    expect(
      screen.getByRole("heading", { name: /Runner\s+–\s+White/ })
    ).toBeVisible();
  });

  it("returns to the resting colourway when the card is left", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProductCard product={runner} />);

    await user.hover(swatch("White"));
    await user.unhover(container.querySelector(".group")!);

    expect(photoName(hero())).toBe("runner-black.png");
    expect(
      screen.getByRole("heading", { name: /Runner\s+–\s+Black/ })
    ).toBeVisible();
  });

  it("shows one swatch per colourway, not per variant", () => {
    // Five variants, two colourways.
    render(<ProductCard product={runner} />);
    expect(swatchCount()).toBe(2);
  });

  it("summarises the sizes when there are more than three", () => {
    // Black stocks EU 42, 43, 44, 45.
    render(<ProductCard product={runner} />);
    expect(screen.getByText("Available in several sizes")).toBeVisible();
  });

  it("names the sizes when there are only a few", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={runner} />);

    // White stocks a single size.
    await user.hover(swatch("White"));
    expect(screen.getByText("EU 42")).toBeVisible();
  });

  it("reports the sizes of the hovered colourway, not the whole product", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={runner} />);

    expect(screen.getByText("Available in several sizes")).toBeVisible();
    await user.hover(swatch("White"));
    expect(screen.queryByText("Available in several sizes")).toBeNull();
  });

  it("carries the previewed colour to the product page", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={runner} />);

    expect(screen.getByRole("link", { name: /Choose Size/ })).toHaveAttribute(
      "href",
      "/products/runner?color=Black"
    );

    await user.hover(swatch("White"));
    expect(screen.getByRole("link", { name: /Choose Size/ })).toHaveAttribute(
      "href",
      "/products/runner?color=White"
    );
  });

  it("marks a sold-out colourway", () => {
    render(
      <ProductCard
        product={{
          ...runner,
          variants: [
            { sku: "a", size: "42", color: "Black", stock: 2 },
            { sku: "b", size: "42", color: "White", stock: 0 },
          ],
        }}
      />
    );

    expect(swatch("White")).toHaveAttribute("title", "White — sold out");
    expect(swatch("Black")).toHaveAttribute("title", "Black");
  });

  it("summarises colourways past the fifth", () => {
    render(
      <ProductCard
        product={{
          ...runner,
          variants: ["Black", "White", "Sand", "Olive", "Red", "Blue"].map(
            (color, i) => ({ sku: `s${i}`, size: "42", color, stock: 1 })
          ),
        }}
      />
    );

    expect(swatchCount()).toBe(5);
    expect(screen.getByText("+1")).toBeVisible();
  });

  it("falls back to the main photo for a colourway with none of its own", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={{ ...runner, colorImages: [] }} />);

    await user.hover(swatch("White"));
    expect(photoName(hero())).toBe("runner-black.png");
  });
});

describe("cards without a colour banner", () => {
  it("shows no swatches for a sold-out product", () => {
    render(<ProductCard product={{ ...runner, stock: 0 }} />);

    expect(swatchCount()).toBe(0);
    expect(screen.getByRole("link", { name: "Out of Stock" })).toBeVisible();
  });

  it("keeps a single-SKU product on its inline add button", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={mug} />);

    expect(screen.getByRole("heading", { name: "Mug" })).toBeVisible();
    expect(screen.queryByText(/Available in several sizes/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    expect(useCartStore.getState().cartProducts[0].id).toBe("mug");
  });
});

describe("the cart state a card reflects", () => {
  it("counts every size of a variant product already in the cart", () => {
    useCartStore.setState({
      cartProducts: [
        { ...runner, quantity: 1, variantSku: "r-42-black" },
        { ...runner, quantity: 2, variantSku: "r-42-white" },
      ],
    });

    render(<ProductCard product={runner} />);
    expect(
      screen.getByRole("link", { name: /In cart \(3\) · Add size/ })
    ).toBeVisible();
  });

  it("does not treat a sized line as a single-SKU cart entry", () => {
    useCartStore.setState({
      cartProducts: [{ ...mug, id: "mug", quantity: 1, variantSku: "x" }],
    });

    render(<ProductCard product={mug} />);
    expect(within(document.body).getByRole("button", { name: "Add to Cart" })).toBeVisible();
  });
});
