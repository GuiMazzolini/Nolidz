// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductGallery from "@/app/products/[id]/ProductGallery";

const PHOTOS = ["/front.jpg", "/side.jpg", "/sole.jpg"];

/** The large image, which is the only one carrying a non-empty alt. */
function hero(): HTMLImageElement {
  return screen.getByAltText(/Runner/) as HTMLImageElement;
}

function thumb(index: number) {
  return screen.getByRole("button", { name: `Show photo ${index} of 3` });
}

describe("ProductGallery", () => {
  it("opens on the first photo", () => {
    render(<ProductGallery images={PHOTOS} alt="Runner" />);
    expect(hero().src).toContain("front.jpg");
  });

  it("shows the photo whose thumbnail is clicked", async () => {
    const user = userEvent.setup();
    render(<ProductGallery images={PHOTOS} alt="Runner" />);

    await user.click(thumb(3));

    expect(hero().src).toContain("sole.jpg");
    expect(thumb(3)).toHaveAttribute("aria-current", "true");
    expect(thumb(1)).toHaveAttribute("aria-current", "false");
  });

  it("steps forward and back with the arrows", async () => {
    const user = userEvent.setup();
    render(<ProductGallery images={PHOTOS} alt="Runner" />);

    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(hero().src).toContain("side.jpg");

    await user.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(hero().src).toContain("front.jpg");
  });

  /** A dead arrow on the last frame reads as broken rather than as a boundary. */
  it("wraps around in both directions", async () => {
    const user = userEvent.setup();
    render(<ProductGallery images={PHOTOS} alt="Runner" />);

    await user.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(hero().src).toContain("sole.jpg");

    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(hero().src).toContain("front.jpg");
  });

  it("moves through the photos with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<ProductGallery images={PHOTOS} alt="Runner" />);

    await user.click(screen.getByRole("button", { name: "Next photo" }));
    await user.keyboard("{ArrowRight}");
    expect(hero().src).toContain("sole.jpg");

    await user.keyboard("{ArrowLeft}");
    expect(hero().src).toContain("side.jpg");
  });

  it("names the current photo for a screen reader", async () => {
    const user = userEvent.setup();
    render(<ProductGallery images={PHOTOS} alt="Runner" />);

    expect(screen.getByAltText("Runner — photo 1 of 3")).toBeInTheDocument();

    await user.click(thumb(2));
    expect(screen.getByAltText("Runner — photo 2 of 3")).toBeInTheDocument();
  });

  /**
   * A one-photo product must render exactly as it did before the gallery
   * existed — no strip, and no controls for a keyboard user to tab past.
   */
  it("renders a single photo with no controls", () => {
    render(<ProductGallery images={["/front.jpg"]} alt="Runner" />);

    expect(screen.getByAltText("Runner")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next photo" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Product photos" })).toBeNull();
  });

  /** Page weight is what a photo cap would have bought; lazy loading buys it instead. */
  it("loads every thumbnail past the first lazily", () => {
    render(<ProductGallery images={PHOTOS} alt="Runner" />);

    const thumbs = PHOTOS.map((_, i) => thumb(i + 1).querySelector("img")!);
    expect(thumbs[0]).toHaveAttribute("loading", "eager");
    expect(thumbs[1]).toHaveAttribute("loading", "lazy");
    expect(thumbs[2]).toHaveAttribute("loading", "lazy");
  });
});
