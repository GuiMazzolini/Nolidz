"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Product } from "../product-data";
import {
  PRODUCT_CATEGORIES,
  categoryHref,
  matchesCategory,
  type CategoryFilter,
} from "../lib/categories";
import { useLocalePath, useT } from "@/app/i18n/client";
import {
  colorwayStock,
  orderColorwaysByPrice,
  spreadColorways,
  toColorways,
  type Colorway,
} from "../lib/colorways";
import CartErrorBanner from "./CartErrorBanner";
import ProductCard from "./ProductCard";

type SortOption = "name-asc" | "price-asc" | "price-desc" | "stock-desc";

export default function ProductsList({
  products,
  initialCategory = "all",
}: {
  products: Product[];
  initialCategory?: CategoryFilter;
}) {
  const t = useT();
  const localePath = useLocalePath();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [category, setCategory] = useState<CategoryFilter>(initialCategory);

  /**
   * One tile per colourway, so a shoe in three colours is three cards.
   *
   * Everything below works on colourways rather than products: a shopper
   * filtering for "black" wants the black pair, not the shoe that happens to
   * come in black among others, and a stock sort that ranked one tile by the
   * whole product's total would order the grid by numbers it never shows.
   */
  const colorways = useMemo(
    () =>
      products
        .filter((product) => matchesCategory(product.category, category))
        .flatMap(toColorways)
        // Sold-out colourways stay out of the grid; admin still sees them.
        .filter((colorway) => colorway.stock > 0)
        .map((colorway) => ({
          ...colorway,
          otherColors: colorway.otherColors.filter(
            (color) => colorwayStock(colorway.product, color) > 0
          ),
        })),
    [products, category]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const next = colorways.filter((colorway: Colorway) => {
      if (!q) return true;
      const { product, color } = colorway;
      return (
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        (color?.toLowerCase().includes(q) ?? false)
      );
    });

    switch (sort) {
      case "stock-desc":
        // Per colourway, which is the number each tile shows. Spreading
        // would hide a high-stock colour behind a sibling that has none.
        return [...next].sort((a, b) => b.stock - a.stock);
      case "price-asc":
        return orderColorwaysByPrice(next, "asc");
      case "price-desc":
        return orderColorwaysByPrice(next, "desc");
      case "name-asc":
      default:
        return spreadColorways(next, (a, b) =>
          a.product.name.localeCompare(b.product.name)
        );
    }
  }, [colorways, query, sort]);

  function selectCategory(next: CategoryFilter) {
    setCategory(next);
    // Prefixed: every route sits under [lang], and a bare path here would
    // bounce through the proxy and lose the `?category=` it just set.
    router.replace(localePath(categoryHref(next)), { scroll: false });
  }

  const heading = category === "all" ? t.catalog.headingAll : t.nav[category];

  return (
    <div className="min-h-screen bg-paper py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm mb-2">
              {t.catalog.eyebrow}
            </p>
            <h1 className="font-display italic font-extrabold text-4xl sm:text-5xl text-ink tracking-tight">
              {heading}
            </h1>
            {/* Counts tiles, which is what the grid shows and what the
                filters act on — products would be a different, lower number. */}
            <p className="mt-2 text-ink/60">
              {t.catalog.countLabel(filtered.length, colorways.length)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-xl">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                {t.catalog.search}
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.catalog.searchPlaceholder}
                className="w-full border-2 border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-cardboard"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">
                {t.catalog.sort}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full border-2 border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-cardboard"
              >
                <option value="name-asc">{t.catalog.sortNameAsc}</option>
                <option value="price-asc">{t.catalog.sortPriceAsc}</option>
                <option value="price-desc">{t.catalog.sortPriceDesc}</option>
                <option value="stock-desc">{t.catalog.sortStockDesc}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mb-8 hidden sm:flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectCategory("all")}
            className={`border-2 px-4 py-2 text-sm font-semibold transition-colors ${
              category === "all"
                ? "border-ink bg-ink text-paper"
                : "border-ink/15 bg-white text-ink/75 hover:border-cardboard-dark"
            }`}
          >
            {t.nav.all}
          </button>
          {PRODUCT_CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => selectCategory(option)}
              className={`border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                category === option
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 bg-white text-ink/75 hover:border-cardboard-dark"
              }`}
            >
              {t.nav[option]}
            </button>
          ))}
        </div>

        <CartErrorBanner />

        {filtered.length === 0 ? (
          <div className="border-2 border-ink/10 bg-white p-10 text-center">
            <h2 className="font-display italic font-extrabold text-2xl text-ink mb-2">
              {t.catalog.emptyHeading}
            </h2>
            <p className="text-ink/60 mb-6">{t.catalog.emptyBody}</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSort("name-asc");
                selectCategory("all");
              }}
              className="inline-block bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/85"
            >
              {t.catalog.resetFilters}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
            {filtered.map((colorway) => (
              <ProductCard key={colorway.key} colorway={colorway} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
