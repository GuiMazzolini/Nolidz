// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { formatMoney } from "@/app/lib/money";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductCard from "@/app/components/ProductCard";
import { toColorways } from "@/app/lib/colorways";
import { useCartStore } from "@/app/lib/store/cartStore";
import type { Product } from "@/app/product-data";

/**
 * A card is one colourway. Colourway construction is covered in
 * colorways.test.ts; this covers what the card does with one.
 */

const runner: Product = {
  id: "runner",
  name: "Runner",
  description: "A shoe",
  imageUrl: "/runner-black.png",
  price: 89.99,
  stock: 11,
  variants: [
    { sku: "r-42-black", size: "42", color: "Black", stock: 3 },
    { sku: "r-43-black", size: "43", color: "Black", stock: 2 },
    { sku: "r-42-white", size: "42", color: "White", stock: 5, price: 109.99 },
    { sku: "r-42-red", size: "42", color: "Red", stock: 1 },
  ],
  colorImages: [
    { color: "Black", imageUrl: "/runner-black.png" },
    { color: "White", imageUrl: "/runner-white.png" },
  ],
  images: ["/sole.png", "/detail.png"],
};

const mug: Product = {
  id: "mug",
  name: "Mug",
  description: "A mug",
  imageUrl: "/mug.png",
  price: 14.99,
  stock: 4,
};

/** The card for one colour of the runner. */
function cardFor(color: string, product: Product = runner) {
  const card = toColorways(product).find((c) => c.color === color);
  if (!card) throw new Error(`no colourway ${color}`);
  return card;
}

function hero(): HTMLImageElement {
  return screen.getByAltText(/^Runner – /) as HTMLImageElement;
}

/** Swatches are hidden from assistive tech, so they are found by their data hook. */
function swatch(color: string): HTMLElement {
  const node = document.querySelector(`[data-color="${color}"]`);
  if (!node) throw new Error(`no swatch for ${color}`);
  return node as HTMLElement;
}

function swatchColors(): string[] {
  return [...document.querySelectorAll("[data-color]")].map(
    (node) => node.getAttribute("data-color")!
  );
}

function colorPreview(): HTMLElement {
  const node = document.querySelector("[data-color-preview]");
  if (!node) throw new Error("no colour preview");
  return node as HTMLElement;
}

function previewShowsOnHover(): boolean {
  return colorPreview().className.includes("group-hover:opacity-100");
}

/** next/image rewrites src; the filename is what identifies the photo. */
function photoName(img: HTMLImageElement) {
  return decodeURIComponent(img.src).split("/").pop();
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

describe("a colourway card", () => {
  it("names the product and its colour", () => {
    render(<ProductCard colorway={cardFor("White")} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Runner – White"
    );
    expect(photoName(hero())).toBe("runner-white.png");
  });

  it("reports the stock of that colour alone", () => {
    render(<ProductCard colorway={cardFor("Red")} />);
    expect(screen.getByText("1 left")).toBeVisible();
  });

  it("links to the product page on its own colour", () => {
    render(<ProductCard colorway={cardFor("White")} />);

    expect(screen.getByRole("link", { name: "View Runner – White" })).toHaveAttribute(
      "href",
      "/products/runner?color=White"
    );
  });

  it("marks a colourway with nothing left as out of stock", () => {
    const gone: Product = {
      ...runner,
      variants: [{ sku: "r-42-black", size: "42", color: "Black", stock: 0 }],
    };
    render(<ProductCard colorway={cardFor("Black", gone)} />);

    expect(screen.getByText("Out of stock")).toBeVisible();
    expect(screen.queryByText(/left$/)).toBeNull();
  });
});

describe("paging through a card's photos", () => {
  it("opens on the colourway photo", () => {
    render(<ProductCard colorway={cardFor("Black")} />);
    expect(photoName(hero())).toBe("runner-black.png");
  });

  it("steps forward and back with the arrows", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    await user.click(
      screen.getByRole("button", { name: "Next photo of Runner – Black" })
    );
    expect(photoName(hero())).toBe("sole.png");

    await user.click(
      screen.getByRole("button", { name: "Previous photo of Runner – Black" })
    );
    expect(photoName(hero())).toBe("runner-black.png");
  });

  it("wraps around in both directions", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    await user.click(
      screen.getByRole("button", { name: "Previous photo of Runner – Black" })
    );
    expect(photoName(hero())).toBe("detail.png");
  });

  /** A one-photo card must not grow controls that do nothing. */
  it("shows no arrows when there is only one photo", () => {
    const plain: Product = { ...runner, images: undefined, colorImages: [] };
    render(<ProductCard colorway={cardFor("Black", plain)} />);

    expect(screen.queryByRole("button", { name: /Next photo/ })).toBeNull();
    expect(screen.getByAltText("Runner – Black")).toBeInTheDocument();
  });

  /**
   * The colour strip covers the photo. Paging hides it so the shot is clear;
   * leaving the card and coming back offers it again.
   */
  it("hides the colour preview while paging, and shows it again after leaving", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    expect(previewShowsOnHover()).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Next photo of Runner – Black" })
    );
    expect(previewShowsOnHover()).toBe(false);

    await user.unhover(screen.getByRole("heading", { level: 2 }));
    expect(previewShowsOnHover()).toBe(true);
  });
});

describe("the swatch banner on a colourway card", () => {
  it("offers the other colours and never its own", () => {
    render(<ProductCard colorway={cardFor("Black")} />);
    expect(swatchColors()).toEqual(["White", "Red"]);

    cleanup();
    render(<ProductCard colorway={cardFor("White")} />);
    expect(swatchColors()).toEqual(["Black", "Red"]);
  });

  it("shows no banner for a product with a single colourway", () => {
    const one: Product = {
      ...runner,
      variants: [{ sku: "r-42-black", size: "42", color: "Black", stock: 1 }],
    };
    render(<ProductCard colorway={cardFor("Black", one)} />);

    expect(swatchColors()).toEqual([]);
  });

  it("marks a sold-out sibling colourway", () => {
    const partly: Product = {
      ...runner,
      variants: [
        { sku: "r-42-black", size: "42", color: "Black", stock: 2 },
        { sku: "r-42-white", size: "42", color: "White", stock: 0 },
      ],
    };
    render(<ProductCard colorway={cardFor("Black", partly)} />);

    expect(swatch("White")).toHaveAttribute("title", "White — sold out");
  });
});

describe("previewing a sibling colourway", () => {
  it("turns the card over to the hovered colour", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    await user.hover(swatch("White"));

    expect(photoName(hero())).toBe("runner-white.png");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Runner – White"
    );
  });

  it("reports the previewed colour's stock, not its own", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    expect(screen.getByText("5 left")).toBeVisible();
    await user.hover(swatch("Red"));
    expect(screen.getByText("1 left")).toBeVisible();
  });

  it("shows the previewed colour's price, not its own", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    expect(screen.getByText(formatMoney(89.99))).toBeVisible();
    await user.hover(swatch("White"));
    expect(screen.getByText(formatMoney(109.99))).toBeVisible();
  });

  it("carries the previewed colour into the links", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    await user.hover(swatch("Red"));

    expect(screen.getByRole("link", { name: "View Runner – Red" })).toHaveAttribute(
      "href",
      "/products/runner?color=Red"
    );
    expect(screen.getByRole("link", { name: "Choose Size" })).toHaveAttribute(
      "href",
      "/products/runner?color=Red"
    );
  });

  it("returns to its own colourway when the card is left", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    await user.hover(swatch("White"));
    expect(photoName(hero())).toBe("runner-white.png");

    await user.unhover(screen.getByRole("heading", { level: 2 }));
    expect(photoName(hero())).toBe("runner-black.png");
  });

  /** A previewed colour brings its own photos, starting at the first. */
  it("resets the gallery position when the preview changes", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={cardFor("Black")} />);

    await user.click(
      screen.getByRole("button", { name: "Next photo of Runner – Black" })
    );
    expect(photoName(hero())).toBe("sole.png");

    // Paging hid the strip; leaving the card brings it back so a sibling
    // can be previewed from whatever shot they were on.
    await user.unhover(screen.getByRole("heading", { level: 2 }));
    await user.hover(swatch("White"));
    expect(photoName(hero())).toBe("runner-white.png");
  });
});

describe("the cart state a card reflects", () => {
  it("counts only the sizes of its own colourway", () => {
    useCartStore.setState({
      cartProducts: [
        { ...runner, variantSku: "r-42-black", quantity: 2 },
        { ...runner, variantSku: "r-43-black", quantity: 1 },
        { ...runner, variantSku: "r-42-white", quantity: 4 },
      ],
    });
    render(<ProductCard colorway={cardFor("Black")} />);

    expect(
      screen.getByRole("link", { name: "In cart (3) · Add size" })
    ).toBeVisible();
  });

  it("sends a variant card to the product page rather than adding inline", () => {
    render(<ProductCard colorway={cardFor("Black")} />);

    expect(screen.getByRole("link", { name: "Choose Size" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add to Cart" })).toBeNull();
  });

  it("keeps a single-SKU product on its inline add button", async () => {
    const user = userEvent.setup();
    render(<ProductCard colorway={toColorways(mug)[0]} />);

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(useCartStore.getState().cartProducts[0].id).toBe("mug");
  });

  it("does not treat a sized line as a single-SKU cart entry", () => {
    useCartStore.setState({
      cartProducts: [{ ...mug, variantSku: "mug-x", quantity: 2 }],
    });
    render(<ProductCard colorway={toColorways(mug)[0]} />);

    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeVisible();
  });
});
