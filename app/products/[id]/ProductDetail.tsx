"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/app/lib/money";
import CartErrorBanner from "@/app/components/CartErrorBanner";
import ProductGallery from "./ProductGallery";
import { productGallery } from "@/app/lib/images";
import { useCartStore } from "@/app/lib/store/cartStore";
import { useCheckout } from "@/app/lib/use-checkout";
import {
  colorwayPrice,
  formatSize,
  hasVariants,
  imageForColor,
  isNumericSize,
  listColors,
  resolveLinePrice,
  variantsForColor,
  type ProductVariant,
} from "@/app/lib/variants";
import type { Product } from "@/app/product-data";

type ProductDetailProps = {
  product: Product;
  /** Colourway chosen on the catalog card, via `?color=`. */
  initialColor?: string | null;
};

export default function ProductDetail({
  product,
  initialColor = null,
}: ProductDetailProps) {
  const [buyingNow, setBuyingNow] = useState(false);

  const cartProducts = useCartStore((s) => s.cartProducts);
  const addToCart = useCartStore((s) => s.addToCart);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const isLoading = useCartStore((s) => s.isLoading);

  const { startCheckout, loading: checkoutLoading } = useCheckout();

  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const isVariantProduct = hasVariants(product);
  // Only colourways that still have at least one size to sell.
  const colors = useMemo(
    () =>
      listColors(variants).filter((c) =>
        variantsForColor(variants, c).some((v) => v.stock > 0)
      ),
    [variants]
  );

  // Opens on the first colourway that has something to sell, so the common
  // case needs one click (a size) rather than two.
  const [color, setColor] = useState<string>(() => {
    const requested = colors.find(
      (c) => c.trim().toLowerCase() === initialColor?.trim().toLowerCase()
    );
    return requested ?? colors[0] ?? "";
  });
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  // Sold-out sizes stay off the grid — shoppers only see what they can buy.
  const sizesForColor = useMemo(
    () =>
      color
        ? variantsForColor(variants, color).filter((v) => v.stock > 0)
        : [],
    [variants, color]
  );

  // Accessories are sold "One size", where an "EU size" heading is wrong.
  const sizeHeading = variants.some((v) => isNumericSize(v.size))
    ? "EU size"
    : "Size";

  const selected: ProductVariant | null = useMemo(
    () => sizesForColor.find((v) => v.sku === selectedSku) ?? null,
    [sizesForColor, selectedSku]
  );

  // Without variants the product itself is the sellable unit.
  const availableStock = isVariantProduct ? (selected?.stock ?? 0) : product.stock;
  const needsSelection = isVariantProduct && !selected;
  const outOfStock = isVariantProduct
    ? variants.every((v) => v.stock < 1)
    : product.stock < 1;

  const sku = selected?.sku;
  const displayPrice = colorwayPrice(product, color || null);
  const inCart = cartProducts.some(
    (p) => p.id === product.id && (p.variantSku ?? undefined) === sku
  );
  const loading = isLoading(product.id, sku);

  /** The exact line being added: product plus the chosen size and colour. */
  function lineToAdd(): Product {
    if (!selected) return product;
    return {
      ...product,
      price: resolveLinePrice(product, selected.sku),
      stock: selected.stock,
      variantSku: selected.sku,
      variantSize: selected.size,
      variantColor: selected.color,
    };
  }

  async function handleAddOrRemove() {
    if (inCart) {
      await removeFromCart(product.id, sku);
      return;
    }
    if (needsSelection) return;
    await addToCart(lineToAdd());
  }

  async function handleBuyNow() {
    if (outOfStock || needsSelection || availableStock < 1) return;
    setBuyingNow(true);
    try {
      if (!inCart) {
        await addToCart(lineToAdd());
        const added = useCartStore
          .getState()
          .cartProducts.some(
            (p) => p.id === product.id && (p.variantSku ?? undefined) === sku
          );
        if (!added) return;
      }
      // Straight to Stripe — the cart page is the only review step.
      await startCheckout();
    } finally {
      setBuyingNow(false);
    }
  }

  function stockMessage(): string {
    if (isVariantProduct) {
      if (outOfStock) return "Out of stock in every size";
      if (!selected) return "Select a size to see availability";
      if (selected.stock < 1) return "This size is sold out";
      const label = formatSize(selected.size);
      return selected.stock <= 5
        ? `Only ${selected.stock} left in ${label}`
        : `${selected.stock} in stock in ${label}`;
    }
    if (outOfStock) return "Out of stock";
    return product.stock <= 5
      ? `Only ${product.stock} left`
      : `${product.stock} in stock`;
  }

  // The hero follows the chosen colourway, matching the catalog swatch that
  // brought the shopper here.
  const heroImage = imageForColor(product, color);

  /**
   * That hero, then the product's other shots. The colourway photo leads
   * because it is the one the shopper picked; the extra angles are of the
   * product as a whole and follow it.
   */
  const gallery = useMemo(
    () => productGallery({ imageUrl: heroImage, images: product.images }),
    [heroImage, product.images]
  );

  const stockToneClass =
    outOfStock || (isVariantProduct && selected && selected.stock < 1)
      ? "text-red-600"
      : availableStock > 0 && availableStock <= 5
        ? "text-amber-600"
        : "text-gray-600";

  return (
    <div className="min-h-screen bg-paper py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <CartErrorBanner />
        <div className="bg-white border-2 border-ink/10 overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-1/2 p-8 bg-paper flex items-center justify-center">
              <ProductGallery
                // Remounting on a colour change resets the gallery to that
                // colourway's hero, rather than leaving a shopper on the third
                // photo of the shoe they just switched away from.
                key={heroImage}
                images={gallery}
                alt={color ? `${product.name} in ${color}` : product.name}
              />
            </div>

            <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
              <div className="mb-6">
                <h1 className="font-display italic font-extrabold text-4xl lg:text-5xl text-ink mb-4 tracking-tight">
                  {product.name}
                  {color && (
                    <span className="font-normal not-italic text-ink/50"> – {color}</span>
                  )}
                </h1>
                <div className="flex items-baseline gap-2">
                  <span className="font-display italic text-4xl font-bold text-cardboard-dark">
                    {formatMoney(displayPrice)}
                  </span>
                </div>
                <p className={`mt-3 text-sm font-medium ${stockToneClass}`}>
                  {stockMessage()}
                </p>
              </div>

              {isVariantProduct && colors.length > 0 && (
                <div className="mb-8 space-y-6">
                  {colors.length > 1 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-ink">
                        Colour:{" "}
                        <span className="font-normal text-ink/60">{color}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setColor(option);
                              // Sizes are per colourway; keeping the old SKU
                              // would leave a size selected that this colour
                              // may not even stock.
                              setSelectedSku(null);
                            }}
              className={`border-2 px-4 py-2.5 min-h-11 text-sm font-medium transition-colors touch-manipulation ${
                              option === color
                                ? "border-ink bg-ink text-paper"
                                : "border-ink/15 text-ink/80 hover:border-cardboard-dark"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-semibold text-ink">
                      {sizeHeading}
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {sizesForColor.map((variant) => {
                        const isSelected = variant.sku === selectedSku;
                        return (
                          <button
                            key={variant.sku}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedSku(variant.sku)}
                            title={`${variant.stock} available`}
                            className={`min-h-11 border-2 py-2.5 text-sm font-medium transition-colors touch-manipulation ${
                              isSelected
                                ? "border-ink bg-ink text-paper"
                                : "border-ink/15 text-ink hover:border-cardboard-dark"
                            }`}
                          >
                            {variant.size}
                          </button>
                        );
                      })}
                    </div>
                    {needsSelection && (
                      <p className="mt-2 text-sm text-ink/50">
                        Choose your size to add this to the cart.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t-2 border-ink/10 pt-6 mb-8">
                <h2 className="font-display italic font-bold text-xl text-ink mb-3">
                  Description
                </h2>
                <p className="text-ink/70 leading-relaxed text-lg">
                  {product.description}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={handleAddOrRemove}
                  disabled={
                    loading || (!inCart && (outOfStock || needsSelection || availableStock < 1))
                  }
                  className={`flex-1 font-semibold py-4 px-8 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      inCart
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-ink text-paper hover:bg-ink/85"
                    }`}
                >
                  {loading
                    ? "..."
                    : inCart
                      ? "Remove from Cart"
                      : outOfStock
                        ? "Out of Stock"
                        : needsSelection
                          ? "Select a Size"
                          : "Add to Cart"}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={
                    loading ||
                    buyingNow ||
                    checkoutLoading ||
                    outOfStock ||
                    needsSelection ||
                    availableStock < 1
                  }
                  className="flex-1 border-2 border-ink/15 bg-white hover:border-cardboard-dark text-ink font-semibold py-4 px-8 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {buyingNow || checkoutLoading ? "Processing..." : "Buy Now"}
                </button>
              </div>

              <div className="mt-8 pt-8 border-t-2 border-ink/10">
                <div className="grid grid-cols-2 gap-4 text-sm text-ink/60">
                  <div>
                    <span className="block font-semibold text-ink">
                      Free Shipping
                    </span>
                    <span>On orders over €100</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-ink">
                      Easy Returns
                    </span>
                    <span>15-day return policy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
