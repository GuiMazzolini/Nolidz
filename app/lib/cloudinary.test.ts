import { describe, expect, it } from "vitest";
import {
  collectCloudinaryUrlsFromProduct,
  publicIdFromCloudinaryUrl,
} from "@/app/lib/cloudinary";

describe("publicIdFromCloudinaryUrl", () => {
  it("reads a public id without a version segment", () => {
    expect(
      publicIdFromCloudinaryUrl(
        "https://res.cloudinary.com/demo/image/upload/runner.png",
        "demo"
      )
    ).toBe("runner");
  });

  it("reads a public id after transforms and a version", () => {
    expect(
      publicIdFromCloudinaryUrl(
        "https://res.cloudinary.com/demo/image/upload/w_1200,q_auto,f_auto/v1786006711/nolidz/products/hat.jpg",
        "demo"
      )
    ).toBe("nolidz/products/hat");
  });

  it("ignores another cloud's URLs", () => {
    expect(
      publicIdFromCloudinaryUrl(
        "https://res.cloudinary.com/other/image/upload/hat.jpg",
        "demo"
      )
    ).toBeNull();
  });
});

describe("collectCloudinaryUrlsFromProduct", () => {
  it("dedupes the hero, colourways and gallery", () => {
    const shared =
      "https://res.cloudinary.com/demo/image/upload/v1/nolidz/products/shared.jpg";
    expect(
      collectCloudinaryUrlsFromProduct({
        imageUrl: shared,
        colorImages: [{ imageUrl: shared }],
        images: [
          shared,
          "https://res.cloudinary.com/demo/image/upload/v1/nolidz/products/sole.jpg",
        ],
      })
    ).toEqual([
      shared,
      "https://res.cloudinary.com/demo/image/upload/v1/nolidz/products/sole.jpg",
    ]);
  });
});
