/**
 * Storefront audience categories.
 *
 * Every sellable shoe belongs to one of these. The shop filter and landing
 * links use the same ids, so a product saved as "women" is what `/products?category=women`
 * returns.
 */

export const PRODUCT_CATEGORIES = ["men", "women", "kids"] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Filter value on the catalog: a category, or everything. */
export type CategoryFilter = ProductCategory | "all";

/**
 * Category names are shopper-facing copy, so they live in the locale
 * dictionaries (`nav.men` / `nav.women` / `nav.kids`) rather than here. The
 * keys there are these same ids, so a category can be looked up directly.
 */

export function isProductCategory(value: unknown): value is ProductCategory {
  return (
    typeof value === "string" &&
    (PRODUCT_CATEGORIES as readonly string[]).includes(value)
  );
}

/** Parse `?category=` from the URL. Anything unknown becomes "all". */
export function parseCategoryFilter(value: string | null | undefined): CategoryFilter {
  if (!value || value === "all") return "all";
  return isProductCategory(value) ? value : "all";
}

export function categoryHref(category: CategoryFilter): string {
  return category === "all" ? "/products" : `/products?category=${category}`;
}

export function matchesCategory(
  productCategory: ProductCategory | null | undefined,
  filter: CategoryFilter
): boolean {
  if (filter === "all") return true;
  return productCategory === filter;
}
