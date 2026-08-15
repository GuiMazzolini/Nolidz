import { describe, expect, it } from "vitest";
import { getImageSrc, productGallery } from "@/app/lib/images";

describe("getImageSrc", () => {
  it("injects Cloudinary transforms before the version segment", () => {
    expect(
      getImageSrc(
        "https://res.cloudinary.com/demo/image/upload/v1786006711/styleshop/products/hat.jpg"
      )
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/w_1200,q_auto,f_auto/v1786006711/styleshop/products/hat.jpg"
    );
  });

  it("does not double-apply transforms", () => {
    const already =
      "https://res.cloudinary.com/demo/image/upload/w_1200,q_auto,f_auto/v1/hat.jpg";
    expect(getImageSrc(already)).toBe(already);
  });

  it("prefixes local filenames", () => {
    expect(getImageSrc("hat.jpg")).toBe("/hat.jpg");
  });
});

describe("productGallery", () => {
  it("puts the main image first and keeps the gallery order", () => {
    expect(
      productGallery({
        imageUrl: "main.jpg",
        images: ["side.jpg", "sole.jpg"],
      })
    ).toEqual(["/main.jpg", "/side.jpg", "/sole.jpg"]);
  });

  it("is just the main image when there is no gallery", () => {
    expect(productGallery({ imageUrl: "main.jpg" })).toEqual(["/main.jpg"]);
  });

  it("drops a gallery entry that repeats the main image", () => {
    expect(
      productGallery({ imageUrl: "main.jpg", images: ["main.jpg", "sole.jpg"] })
    ).toEqual(["/main.jpg", "/sole.jpg"]);
  });

  it("collapses duplicates that differ only by an applied transform", () => {
    const raw = "https://res.cloudinary.com/demo/image/upload/v1/hat.jpg";
    const transformed = getImageSrc(raw);

    expect(productGallery({ imageUrl: raw, images: [transformed] })).toEqual([
      transformed,
    ]);
  });

  it("skips blank entries rather than rendering a broken image", () => {
    expect(
      productGallery({ imageUrl: "main.jpg", images: ["", "  ", "sole.jpg"] })
    ).toEqual(["/main.jpg", "/sole.jpg"]);
  });
});
