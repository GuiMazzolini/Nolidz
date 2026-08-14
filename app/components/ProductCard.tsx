"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Product } from "../product-data";
import { getImageSrc } from "../lib/images";
import { useCartStore } from "../lib/store/cartStore";
import {
  hasVariants,
  imageForColor,
  listColors,
  sizesAvailableLabel,
  variantsForColor,
} from "../lib/variants";

/** Swatches past this are summarised as "+N", as the strip has finite width. */
const MAX_SWATCHES = 5;

export default function ProductCard({ product }: { product: Product }) {
  const cartProducts = useCartStore((s) => s.cartProducts);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const isLoading = useCartStore((s) => s.isLoading);

  // Size and colour are picked on the product page, so a variant product never
  // gets an inline add button — there is no single SKU the card could add.
  const isVariantProduct = hasVariants(product);
  const variants = product.variants ?? [];
  const colors = isVariantProduct ? listColors(variants) : [];

  /**
   * The colourway the card is currently presenting. Hovering a swatch previews
   * that colour; leaving the strip falls back to the first one, so the card
   * always shows a real colourway rather than an empty state.
   */
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const activeColor = previewColor ?? colors[0] ?? null;

  const heroImage = imageForColor(product, activeColor);
  const sizesLabel = activeColor
    ? sizesAvailableLabel(variantsForColor(variants, activeColor))
    : null;

  const entry = isVariantProduct
    ? undefined
    : cartProducts.find((cp) => cp.id === product.id && !cp.variantSku);
  const inCart = !!entry;
  const quantity = entry?.quantity || 0;
  const loading = isLoading(product.id);
  const outOfStock = product.stock < 1;
  const atStockLimit = quantity >= product.stock;
  const unitsInCart = isVariantProduct
    ? cartProducts
        .filter((cp) => cp.id === product.id && cp.variantSku)
        .reduce((sum, cp) => sum + (cp.quantity || 1), 0)
    : 0;

  // Carries the previewed colour through to the product page, so clicking a
  // swatch opens the colourway the shopper was actually looking at.
  const href = activeColor
    ? `/products/${product.id}?color=${encodeURIComponent(activeColor)}`
    : `/products/${product.id}`;

  return (
    <div
      className="group"
      // Leaving the card drops the preview, so the grid returns to its resting
      // colourway rather than keeping whichever swatch was last brushed.
      onMouseLeave={() => setPreviewColor(null)}
    >
      <Link href={href}>
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="relative w-full aspect-square bg-gray-100">
            <Image
              key={heroImage}
              src={getImageSrc(heroImage)}
              alt={
                activeColor ? `${product.name} in ${activeColor}` : product.name
              }
              fill
              unoptimized
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {outOfStock && (
              <span className="absolute left-3 top-3 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                Out of stock
              </span>
            )}

            {colors.length > 0 && !outOfStock && (
              /**
               * Revealed on hover so the resting grid stays calm.
               *
               * Hidden from assistive tech: it is a mouse affordance that sits
               * in the DOM at all times, and announcing a strip of swatches on
               * every card would bury the product names. Nothing here is
               * exclusive to it — the colourway is in the heading as text, and
               * the product page carries the full picker.
               */
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-white/95 px-3 py-2 opacity-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
              >
                {sizesLabel && (
                  <p className="mb-1.5 truncate text-[11px] font-medium text-gray-700">
                    {sizesLabel}
                  </p>
                )}

                <div className="flex items-center gap-1.5">
                  {colors.slice(0, MAX_SWATCHES).map((color) => {
                    const soldOut = variantsForColor(variants, color).every(
                      (v) => v.stock < 1
                    );
                    const active = color === activeColor;
                    return (
                      <span
                        key={color}
                        // A span, not a button: the whole card is already a
                        // link, and an interactive element nested inside an
                        // anchor is invalid markup.
                        data-color={color}
                        title={soldOut ? `${color} — sold out` : color}
                        onMouseEnter={() => setPreviewColor(color)}
                        className={`relative block h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-gray-100 transition-colors ${
                          active
                            ? "border-gray-900"
                            : "border-gray-200 hover:border-gray-400"
                        } ${soldOut ? "opacity-40" : ""}`}
                      >
                        <Image
                          src={getImageSrc(imageForColor(product, color))}
                          alt=""
                          fill
                          unoptimized
                          sizes="36px"
                          className="object-cover"
                        />
                      </span>
                    );
                  })}

                  {colors.length > MAX_SWATCHES && (
                    <span className="px-1 text-xs font-medium text-gray-600">
                      +{colors.length - MAX_SWATCHES}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2 group-hover:text-blue-600 transition-colors">
              {product.name}
              {activeColor && (
                <span className="font-normal text-gray-600"> – {activeColor}</span>
              )}
            </h2>

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold text-blue-600">
                ${product.price.toFixed(2)}
              </span>
              {!outOfStock && (
                <span className="text-xs text-gray-500">
                  {product.stock} left
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {isVariantProduct ? (
        <Link
          href={href}
          className={`mt-3 block w-full rounded-lg py-2 text-center font-semibold transition-all duration-200 ${
            outOfStock
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          aria-disabled={outOfStock}
        >
          {outOfStock
            ? "Out of Stock"
            : unitsInCart > 0
              ? `In cart (${unitsInCart}) · Add size`
              : "Choose Size"}
        </Link>
      ) : inCart ? (
        <div className="mt-3 flex items-center justify-between border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => updateQuantity(product.id, quantity - 1)}
            disabled={loading}
            aria-label={quantity <= 1 ? "Remove from cart" : "Decrease quantity"}
            className="px-4 py-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {quantity <= 1 ? (
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            ) : (
              "−"
            )}
          </button>

          <span className="font-semibold min-w-8 text-center">
            {loading ? "..." : quantity}
          </span>

          <button
            onClick={() => updateQuantity(product.id, quantity + 1)}
            disabled={loading || atStockLimit}
            aria-label="Increase quantity"
            className="px-4 py-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={() => addToCart(product)}
          disabled={loading || outOfStock}
          className={`
            w-full mt-3 py-2 rounded-lg font-semibold
            transition-all duration-200
            ${
              outOfStock
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }
            ${loading && "opacity-50 cursor-not-allowed"}
          `}
        >
          {loading ? "Adding..." : outOfStock ? "Out of Stock" : "Add to Cart"}
        </button>
      )}
    </div>
  );
}
