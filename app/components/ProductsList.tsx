"use client";

import { useMemo, useState } from "react";
import { Product } from "../product-data";
import { toColorways, type Colorway } from "../lib/colorways";
import CartErrorBanner from "./CartErrorBanner";
import ProductCard from "./ProductCard";

type SortOption = "name-asc" | "price-asc" | "price-desc" | "stock-desc";

export default function ProductsList({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("name-asc");

  /**
   * One tile per colourway, so a shoe in three colours is three cards.
   *
   * Everything below works on colourways rather than products: a shopper
   * filtering for "black" wants the black pair, not the shoe that happens to
   * come in black among others, and a stock sort that ranked one tile by the
   * whole product's total would order the grid by numbers it never shows.
   */
  const colorways = useMemo(
    () => products.flatMap(toColorways),
    [products]
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

    return [...next].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.product.price - b.product.price;
        case "price-desc":
          return b.product.price - a.product.price;
        case "stock-desc":
          return b.stock - a.stock;
        case "name-asc":
        default:
          // Colourways of one shoe stay adjacent, in the admin's entry order.
          return (
            a.product.name.localeCompare(b.product.name) ||
            (a.color ?? "").localeCompare(b.color ?? "")
          );
      }
    });
  }, [colorways, query, sort]);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Our Products</h1>
            {/* Counts tiles, which is what the grid shows and what the
                filters act on — products would be a different, lower number. */}
            <p className="mt-2 text-gray-600">
              {filtered.length} of {colorways.length} items
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-xl">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Search
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or description"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Sort
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="name-asc">Name A–Z</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="stock-desc">Stock: high to low</option>
              </select>
            </label>
          </div>
        </div>

        <CartErrorBanner />

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No products match
            </h2>
            <p className="text-gray-600 mb-6">
              Try a different search term or reset the filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSort("name-asc");
              }}
              className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((colorway) => (
              <ProductCard key={colorway.key} colorway={colorway} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
