"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { getImageSrc, productGallery } from "../lib/images";
import { colorwayStock, type Colorway } from "../lib/colorways";
import { useCartStore } from "../lib/store/cartStore";
import { imageForColor, sizesAvailableLabel, variantsForColor } from "../lib/variants";

/** Swatches past this are summarised as "+N", as the strip has finite width. */
const MAX_SWATCHES = 5;

export default function ProductCard({ colorway }: { colorway: Colorway }) {
  const { product, color, images, otherColors } = colorway;
  const variants = useMemo(() => product.variants ?? [], [product.variants]);

  const cartProducts = useCartStore((s) => s.cartProducts);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const isLoading = useCartStore((s) => s.isLoading);

  /**
   * The sibling colourway being previewed, if any.
   *
   * The card belongs to one colour, and the strip offers the others. Hovering
   * one turns the whole card over to it — photo, name, sizes, stock and link —
   * so a shopper can look through the range without leaving the grid. Leaving
   * the card returns it to its own colour, so the grid always rests on the
   * colourway each tile is actually for.
   */
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const activeColor = previewColor ?? color;

  // Previewing a sibling shows that colour's photos, so the gallery follows it.
  const activeImages = useMemo(
    () =>
      previewColor
        ? productGallery({
            imageUrl: imageForColor(product, previewColor),
            images: product.images,
          })
        : images,
    [previewColor, product, images]
  );

  /**
   * Which photo is showing, and the colourway it belongs to.
   *
   * The colour is stored with the index so switching preview resets to that
   * colour's first photo — derived rather than synchronised in an effect, which
   * would re-render the card a second time on every hover.
   */
  const [position, setPosition] = useState<{ color: string | null; index: number }>(
    { color: activeColor, index: 0 }
  );
  const active = position.color === activeColor ? position.index : 0;

  const count = activeImages.length;
  const step = useCallback(
    (delta: number) =>
      setPosition({
        color: activeColor,
        index: (active + delta + count) % count,
      }),
    [activeColor, active, count]
  );
  const current = activeImages[Math.min(active, count - 1)];

  // Size and colour are picked on the product page, so a variant product never
  // gets an inline add button — there is no single SKU the card could add.
  const isVariantProduct = color !== null;

  const sizesLabel = activeColor
    ? sizesAvailableLabel(variantsForColor(variants, activeColor))
    : null;

  const stock = colorwayStock(product, activeColor);
  const outOfStock = stock < 1;

  const entry = isVariantProduct
    ? undefined
    : cartProducts.find((cp) => cp.id === product.id && !cp.variantSku);
  const inCart = !!entry;
  const quantity = entry?.quantity || 0;
  const loading = isLoading(product.id);
  const atStockLimit = quantity >= stock;

  /**
   * Units of the shown colourway already in the cart, counted by the SKUs
   * belonging to it — the black tile does not report the white pairs.
   */
  const unitsInCart = useMemo(() => {
    if (!activeColor) return 0;
    const skus = new Set(variantsForColor(variants, activeColor).map((v) => v.sku));
    return cartProducts
      .filter((cp) => cp.id === product.id && cp.variantSku && skus.has(cp.variantSku))
      .reduce((sum, cp) => sum + (cp.quantity || 1), 0);
  }, [activeColor, variants, cartProducts, product.id]);

  // Carries the previewed colour through, so clicking while looking at a
  // sibling opens that colourway rather than the tile's own.
  const href = activeColor
    ? `/products/${product.id}?color=${encodeURIComponent(activeColor)}`
    : `/products/${product.id}`;
  const label = activeColor ? `${product.name} – ${activeColor}` : product.name;

  return (
    <div
      className="group"
      // Leaving the card drops the preview, so the grid returns to its resting
      // colourway rather than keeping whichever swatch was last brushed.
      onMouseLeave={() => setPreviewColor(null)}
    >
      <div className="overflow-hidden rounded-xl bg-white shadow-md transition-all duration-300 hover:shadow-xl group-hover:-translate-y-1">
        <div className="relative aspect-square w-full bg-gray-100">
          <Image
            key={current}
            src={current}
            alt={count > 1 ? `${label} — photo ${active + 1} of ${count}` : label}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/*
            An overlay link rather than a wrapper: the arrows below are buttons,
            and a button inside an anchor is invalid markup. Sitting above the
            photo and below the controls keeps the whole tile clickable without
            swallowing them.
          */}
          <Link
            href={href}
            className="absolute inset-0 z-10"
            aria-label={`View ${label}`}
          />

          {outOfStock && (
            <span className="absolute left-3 top-3 z-20 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">
              Out of stock
            </span>
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={`Previous photo of ${label}`}
                className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/85 p-1.5 text-gray-800 opacity-0 shadow transition-opacity hover:bg-white focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-600 group-hover:opacity-100"
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={`Next photo of ${label}`}
                className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/85 p-1.5 text-gray-800 opacity-0 shadow transition-opacity hover:bg-white focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-600 group-hover:opacity-100"
              >
                <Chevron direction="right" />
              </button>
            </>
          )}

          {otherColors.length > 0 && !outOfStock && (
            /**
             * The same shoe's other colourways, revealed on hover so the
             * resting grid stays calm.
             *
             * Hidden from assistive tech: it is a mouse affordance that sits in
             * the DOM at all times, and announcing a strip of swatches on every
             * card would bury the product names. Nothing here is exclusive to
             * it — every colourway has its own card in this grid, and the
             * product page carries the full picker.
             */
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-2 bg-white/95 px-3 py-2 opacity-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
            >
              {sizesLabel && (
                <p className="mb-1.5 truncate text-[11px] font-medium text-gray-700">
                  {sizesLabel}
                </p>
              )}

              <div className="flex items-center gap-1.5">
                {otherColors.slice(0, MAX_SWATCHES).map((other) => {
                  const soldOut = variantsForColor(variants, other).every(
                    (v) => v.stock < 1
                  );
                  const previewing = other === previewColor;
                  return (
                    <span
                      key={other}
                      // A span, not a link: it sits over the tile's own overlay
                      // anchor, which already carries the previewed colour's
                      // href, and nesting interactive elements would be invalid.
                      data-color={other}
                      title={soldOut ? `${other} — sold out` : other}
                      onMouseEnter={() => setPreviewColor(other)}
                      className={`relative block h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-gray-100 transition-colors ${
                        previewing
                          ? "border-gray-900"
                          : "border-gray-200 hover:border-gray-400"
                      } ${soldOut ? "opacity-40" : ""}`}
                    >
                      <Image
                        src={getImageSrc(imageForColor(product, other))}
                        alt=""
                        fill
                        unoptimized
                        sizes="36px"
                        className="object-cover"
                      />
                    </span>
                  );
                })}

                {otherColors.length > MAX_SWATCHES && (
                  <span className="px-1 text-xs font-medium text-gray-600">
                    +{otherColors.length - MAX_SWATCHES}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <h2 className="mb-2 text-lg font-semibold transition-colors group-hover:text-blue-600">
            <Link href={href}>
              {product.name}
              {activeColor && (
                <span className="font-normal text-gray-600"> – {activeColor}</span>
              )}
            </Link>
          </h2>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold text-blue-600">
              ${product.price.toFixed(2)}
            </span>
            {!outOfStock && (
              <span className="text-xs text-gray-500">{stock} left</span>
            )}
          </div>
        </div>
      </div>

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
        <div className="mt-3 flex items-center justify-between overflow-hidden rounded-lg border border-gray-300">
          <button
            onClick={() => updateQuantity(product.id, quantity - 1)}
            disabled={loading}
            aria-label={quantity <= 1 ? "Remove from cart" : "Decrease quantity"}
            className="flex items-center justify-center px-4 py-2 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {quantity <= 1 ? (
              <svg
                className="h-4 w-4 text-red-600"
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

          <span className="min-w-8 text-center font-semibold">
            {loading ? "..." : quantity}
          </span>

          <button
            onClick={() => updateQuantity(product.id, quantity + 1)}
            disabled={loading || atStockLimit}
            aria-label="Increase quantity"
            className="px-4 py-2 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
        </div>
      ) : (
        <button
          onClick={() => addToCart(product)}
          disabled={loading || outOfStock}
          className={`mt-3 w-full rounded-lg py-2 font-semibold transition-all duration-200 ${
            outOfStock
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-blue-600 text-white hover:bg-blue-700"
          } ${loading && "cursor-not-allowed opacity-50"}`}
        >
          {loading ? "Adding..." : outOfStock ? "Out of Stock" : "Add to Cart"}
        </button>
      )}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}
