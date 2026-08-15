// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Each row carries a delete button, which reaches for the router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AdminProductsTable, { type AdminProduct } from "./AdminProductsTable";

const runner: AdminProduct = {
  id: "runner",
  name: "Runner",
  price: 89.99,
  imageUrl: "/runner.png",
  stock: 10,
  heldForCheckout: 0,
  variants: [
    { sku: "r-42-black", size: "42", color: "Black", stock: 6 },
    { sku: "r-43-black", size: "43", color: "Black", stock: 4 },
  ],
};

describe("stock held by checkouts in progress", () => {
  it("explains the gap between the shelf and the shop", () => {
    render(
      <AdminProductsTable products={[{ ...runner, heldForCheckout: 2 }]} />
    );

    // The column shows 10 on the shelf while only 8 are for sale, so the
    // difference has to be visible or the number looks wrong.
    expect(screen.getByText("2 held in checkout")).toBeVisible();
  });

  it("stays out of the way when nothing is held", () => {
    render(<AdminProductsTable products={[runner]} />);

    expect(screen.queryByText(/held in checkout/)).toBeNull();
  });
});
