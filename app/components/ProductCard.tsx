"use client";

import Image from "next/image";
import { formatMoney } from "@/app/lib/money";
import Link from "@/app/i18n/Link";
import { useCallback, useMemo, useState } from "react";
import { getImageSrc, productGallery } from "../lib/images";
import { colorwayStock, type Colorway } from "../lib/colorways";
import { useCartStore } from "../lib/store/cartStore";
import { useLocale, useT } from "@/app/i18n/client";
import { colorwayPrice, imageForColor, sizesAvailableLabel, variantsForColor } from "../lib/variants";

/** Swatches past this are summarised as "+N", as the strip has finite width. */
const MAX_SWATCHES = 5;

export default function ProductCard({ colorway }: { colorway: Colorway }) {
  const t = useT();
  const locale = useLocale();
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
  /**
   * The colour strip sits over the photo. Once a shopper pages the gallery
   * it is in the way, so it stays down until they leave the card. Coming
   * back shows it again — they can still preview a sibling if they want to.
   */
  const [browsingPhotos, setBrowsingPhotos] = useState(false);
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
    (delta: number) => {
      setBrowsingPhotos(true);
      setPosition({
        color: activeColor,
        index: (active + delta + count) % count,
      });
    },
    [activeColor, active, count]
  );
  const current = activeImages[Math.min(active, count - 1)];

  // Size and colour are picked on the product page, so a variant product never
  // gets an inline add button — there is no single SKU the card could add.
  const isVariantProduct = color !== null;

  const sizesLabel = activeColor
    ? sizesAvailableLabel(
        variantsForColor(variants, activeColor),
        undefined,
        t.productCard.manySizes
      )
    : null;

  const stock = colorwayStock(product, activeColor);
  const displayPrice = colorwayPrice(product, activeColor);
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
      className="group flex h-full flex-col"
      // Leaving the card drops the preview, so the grid returns to its resting
      // colourway rather than keeping whichever swatch was last brushed. It
      // also brings the strip back on the next hover, in case they want it.
      onMouseLeave={() => {
        setPreviewColor(null);
        setBrowsingPhotos(false);
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-ink/10 bg-white transition-colors duration-300 group-hover:border-cardboard">
        <div className="relative aspect-square w-full shrink-0 bg-paper">
          <Image
            key={current}
            src={current}
            alt={
              count > 1
                ? t.productCard.photoOf(label, active + 1, count)
                : label
            }
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
            aria-label={t.productCard.view(label)}
          />

          {outOfStock && (
            <span className="absolute left-3 top-3 z-20 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">
              {t.productCard.outOfStockBadge}
            </span>
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t.productCard.previousPhotoOf(label)}
                className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-ink opacity-0 shadow transition-opacity hover:bg-white focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cardboard group-hover:opacity-100"
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t.productCard.nextPhotoOf(label)}
                className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-ink opacity-0 shadow transition-opacity hover:bg-white focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cardboard group-hover:opacity-100"
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
              data-color-preview
              className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-2 bg-white/95 px-3 py-2 opacity-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-200 ${
                browsingPhotos
                  ? ""
                  : "group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
              }`}
            >
              {sizesLabel && (
                <p className="mb-1.5 truncate text-[11px] font-medium text-ink/70">
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
                      title={soldOut ? t.productCard.soldOutSwatch(other) : other}
                      onMouseEnter={() => setPreviewColor(other)}
                      className={`relative block h-9 w-9 shrink-0 overflow-hidden border bg-paper transition-colors ${
                        previewing
                          ? "border-ink"
                          : "border-ink/15 hover:border-cardboard-dark"
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
                  <span className="px-1 text-xs font-medium text-ink/55">
                    +{otherColors.length - MAX_SWATCHES}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4 border-t-2 border-ink/10">
          <h2 className="mb-2 line-clamp-2 h-14 text-lg font-semibold leading-snug transition-colors group-hover:text-cardboard-dark">
            <Link href={href} title={label}>
              {product.name}
              {activeColor && (
                <span className="font-normal text-ink/55"> – {activeColor}</span>
              )}
            </Link>
          </h2>

          <div className="mt-auto flex items-baseline justify-between gap-2">
            <span className="font-display italic text-2xl font-bold text-cardboard-dark">
              {formatMoney(displayPrice, undefined, locale)}
            </span>
            {!outOfStock && (
              <span className="text-xs text-ink/45">
                {t.productCard.stockLeft(stock)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 shrink-0">
        {isVariantProduct ? (
          <Link
            href={href}
            className={`block w-full py-2.5 text-center font-semibold transition-colors duration-200 ${
              outOfStock
                ? "cursor-not-allowed bg-ink/10 text-ink/40"
                : "bg-ink text-paper hover:bg-ink/85"
            }`}
            aria-disabled={outOfStock}
          >
            {outOfStock
              ? t.productCard.outOfStock
              : unitsInCart > 0
                ? t.productCard.inCartAddSize(unitsInCart)
                : t.productCard.chooseSize}
          </Link>
        ) : inCart ? (
          <div className="flex items-center justify-between overflow-hidden border-2 border-ink/15 bg-white">
            <button
              onClick={() => updateQuantity(product.id, quantity - 1)}
              disabled={loading}
              aria-label={
                quantity <= 1
                  ? t.productCard.removeFromCart
                  : t.productCard.decreaseQuantity
              }
              className="flex items-center justify-center px-4 py-2 transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
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
              aria-label={t.productCard.increaseQuantity}
              className="px-4 py-2 transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={() => addToCart(product)}
            disabled={loading || outOfStock}
            className={`w-full py-2.5 font-semibold transition-colors duration-200 ${
              outOfStock
                ? "cursor-not-allowed bg-ink/10 text-ink/40"
                : "bg-ink text-paper hover:bg-ink/85"
            } ${loading && "cursor-not-allowed opacity-50"}`}
          >
            {loading
              ? t.productCard.adding
              : outOfStock
                ? t.productCard.outOfStock
                : t.productCard.addToCart}
          </button>
        )}
      </div>
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
