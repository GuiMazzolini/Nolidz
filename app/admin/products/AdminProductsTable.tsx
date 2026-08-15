"use client";

import Image from "next/image";
import { formatMoney } from "@/app/lib/money";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/app/lib/categories";
import { getImageSrc } from "@/app/lib/images";
import type { ProductCategory } from "@/app/lib/categories";
import type { ProductVariant } from "@/app/lib/variants";
import DeleteProductButton from "./DeleteProductButton";

export type AdminProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  /**
   * Units on the shelf; for a variant product, the sum across every
   * size/colour. Includes anything held by a checkout in progress, so it can
   * read higher than what the storefront currently offers.
   */
  stock: number;
  category?: ProductCategory;
  variants?: ProductVariant[];
  /** Of `stock`, how many are spoken for by a checkout that has not paid. */
  heldForCheckout: number;
};

type StockFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";
type SortOption = "name-asc" | "price-asc" | "price-desc" | "stock-asc";

const LOW_STOCK_THRESHOLD = 5;

/** "8 of 10 combos in stock · 2 sold out" — surfaces gaps a total hides. */
function variantSummary(variants: ProductVariant[]): string {
  const inStock = variants.filter((v) => v.stock > 0).length;
  const soldOut = variants.length - inStock;
  const base = `${inStock} of ${variants.length} combos in stock`;
  return soldOut > 0 ? `${base} · ${soldOut} sold out` : base;
}

export default function AdminProductsTable({
  products,
}: {
  products: AdminProduct[];
}) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sort, setSort] = useState<SortOption>("name-asc");

  const lowStockCount = products.filter(
    (p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD
  ).length;
  const outOfStockCount = products.filter((p) => p.stock < 1).length;

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    let next = products.filter((product) => {
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.id.toLowerCase().includes(q);

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && product.stock > LOW_STOCK_THRESHOLD) ||
        (stockFilter === "low-stock" &&
          product.stock > 0 &&
          product.stock <= LOW_STOCK_THRESHOLD) ||
        (stockFilter === "out-of-stock" && product.stock < 1);

      return matchesQuery && matchesStock;
    });

    next = [...next].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "stock-asc":
          return a.stock - b.stock;
        case "name-asc":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return next;
  }, [products, query, stockFilter, sort]);

  return (
    <div className="space-y-6">
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="border-2 border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Inventory attention needed</p>
          <p className="mt-1">
            {outOfStockCount > 0 && (
              <span>
                {outOfStockCount} out of stock
                {lowStockCount > 0 ? " · " : ""}
              </span>
            )}
            {lowStockCount > 0 && (
              <span>
                {lowStockCount} low stock (≤ {LOW_STOCK_THRESHOLD})
              </span>
            )}
            . Use the filters below to review them.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/70">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or id"
            className="w-full border-2 border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-cardboard"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/70">
            Stock filter
          </span>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            className="w-full border-2 border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-cardboard"
          >
            <option value="all">All products</option>
            <option value="in-stock">Healthy stock</option>
            <option value="low-stock">Low stock</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/70">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="w-full border-2 border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-cardboard"
          >
            <option value="name-asc">Name A–Z</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="stock-asc">Stock: low to high</option>
          </select>
        </label>
      </div>

      <p className="text-sm text-ink/60">
        Showing {filteredProducts.length} of {products.length} products
      </p>

      <div className="overflow-hidden border-2 border-ink/10 bg-white">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-paper text-left text-ink/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink/45">
                  No products match these filters.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-ink/10 bg-paper">
                        <Image
                          src={getImageSrc(product.imageUrl)}
                          alt=""
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-ink">{product.name}</p>
                        <p className="text-xs text-ink/45">{product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {product.category
                      ? CATEGORY_LABELS[product.category]
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-display italic font-bold text-cardboard-dark">
                    {formatMoney(product.price)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        product.stock < 1
                          ? "font-semibold text-red-600"
                          : product.stock <= LOW_STOCK_THRESHOLD
                            ? "font-semibold text-amber-600"
                            : "text-ink/80"
                      }
                    >
                      {product.stock}
                      {product.stock < 1
                        ? " · Out"
                        : product.stock <= LOW_STOCK_THRESHOLD
                          ? " · Low"
                          : ""}
                    </span>
                    {product.variants && product.variants.length > 0 && (
                      <p className="mt-0.5 text-xs text-ink/45">
                        {variantSummary(product.variants)}
                      </p>
                    )}
                    {product.heldForCheckout > 0 && (
                      // Otherwise this column reads higher than what the shop
                      // will actually sell, with nothing to explain the gap.
                      <p className="mt-0.5 text-xs text-cardboard-dark">
                        {product.heldForCheckout} held in checkout
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="font-medium text-cardboard-dark hover:text-ink"
                      >
                        Edit
                      </Link>
                      <DeleteProductButton
                        productId={product.id}
                        productName={product.name}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
