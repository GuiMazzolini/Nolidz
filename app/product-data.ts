import type { ColorImage, ProductVariant } from "./lib/variants";
import type { ProductCategory } from "./lib/categories";

export interface Product {
  id: string;
  imageUrl: string;
  name: string;
  description: string;
  price: number;
  /**
   * Units available for sale. For a product with variants this is the sum of
   * every variant's stock, maintained by the server.
   */
  stock: number;
  /** Who the shoe is listed for. Absent on older documents. */
  category?: ProductCategory;
  /** Sellable size/colour combinations. Absent on single-SKU products. */
  variants?: ProductVariant[];
  /** Per-colourway photography, keyed by colour name. */
  colorImages?: ColorImage[];
  /** Extra gallery shots, in display order. The main `imageUrl` is not repeated. */
  images?: string[];
  /**
   * Display labels for `variants[].color` in the active locale. Canonical
   * English colour strings stay on the variants for URLs and matching.
   */
  colorLabels?: Record<string, string>;
  /** Cart line quantity (not stored on the product catalog doc). */
  quantity?: number;
  /** Cart line variant, denormalized so the cart renders without a lookup. */
  variantSku?: string;
  variantSize?: string;
  variantColor?: string;
}
