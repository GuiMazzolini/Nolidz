"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Product } from "../product-data";
import {
  catalogHref,
  matchesCategory,
  parseCatalogSort,
  parseCategoryFilter,
  type CatalogSortOption,
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

function ProductsListInner({ products }: { products: Product[] }) {
  const t = useT();
  const localePath = useLocalePath();
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = parseCategoryFilter(searchParams.get("category"));
  const sortFromUrl = parseCatalogSort(searchParams.get("sort"));
  const qFromUrl = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(qFromUrl);
  const [sort, setSort] = useState(sortFromUrl);

  // Browser back / shared links restore filters from the URL.
  useEffect(() => {
    setQuery(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    setSort(sortFromUrl);
  }, [sortFromUrl]);

  function replaceCatalog({
    nextCategory = category,
    nextQuery = query,
    nextSort = sort,
  }: {
    nextCategory?: CategoryFilter;
    nextQuery?: string;
    nextSort?: CatalogSortOption;
  } = {}) {
    router.replace(
      localePath(
        catalogHref({
          category: nextCategory,
          q: nextQuery,
          sort: nextSort,
        })
      ),
      { scroll: false }
    );
  }

  const colorways = useMemo(
    () =>
      products
        .filter((product) => matchesCategory(product.category, category))
        .flatMap(toColorways)
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
      const colorLabel = color
        ? product.colorLabels?.[color] ?? color
        : "";
      const anyColorLabel = Object.values(product.colorLabels ?? {}).some(
        (label) => label.toLowerCase().includes(q)
      );
      return (
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        (color?.toLowerCase().includes(q) ?? false) ||
        colorLabel.toLowerCase().includes(q) ||
        anyColorLabel
      );
    });

    switch (sort) {
      case "stock-desc":
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
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  replaceCatalog({ nextQuery: next });
                }}
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
                onChange={(e) => {
                  const nextSort = e.target.value as CatalogSortOption;
                  setSort(nextSort);
                  replaceCatalog({ nextSort });
                }}
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
                replaceCatalog({
                  nextCategory: "all",
                  nextQuery: "",
                  nextSort: "name-asc",
                });
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

export default function ProductsList({ products }: { products: Product[] }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper py-12">
          <div className="container mx-auto px-4 max-w-7xl animate-pulse">
            <div className="mb-8 h-24 bg-ink/5" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-ink/5" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ProductsListInner products={products} />
    </Suspense>
  );
}
