import type { ProductDoc } from "@/app/lib/db-collections";
import type { ProductVariant } from "@/app/lib/variants";

export const RUNNER_VARIANTS: ProductVariant[] = [
  { sku: "runner-eu42-black", size: "42", color: "Black", stock: 3 },
  { sku: "runner-eu43-black", size: "43", color: "Black", stock: 0 },
  { sku: "runner-eu42-white", size: "42", color: "White", stock: 6 },
];

/** Sells by EU size and colour: three combinations, one of them sold out. */
export const runnerProduct: ProductDoc = {
  id: "runner",
  name: "Runner",
  description: "A shoe",
  price: 89.99,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/runner.png",
  stock: 9,
  variants: RUNNER_VARIANTS,
};

/** Single-SKU product, as everything in the catalog was before variants. */
export const mugProduct: ProductDoc = {
  id: "mug",
  name: "Mug",
  description: "A mug",
  price: 14.99,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/mug.png",
  stock: 2,
};

export const soldOutProduct: ProductDoc = {
  id: "pins",
  name: "Pins",
  description: "Pins",
  price: 12.99,
  imageUrl: "https://res.cloudinary.com/demo/image/upload/pins.png",
  stock: 0,
};

export const catalog = [runnerProduct, mugProduct, soldOutProduct];

export const BUYER = "buyer@example.com";
export const ADMIN = "admin@example.com";
