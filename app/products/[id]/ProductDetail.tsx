"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import CartErrorBanner from "@/app/components/CartErrorBanner";
import { getImageSrc } from "@/app/lib/images";
import { useCartStore } from "@/app/lib/store/cartStore";
import { useCheckout } from "@/app/lib/use-checkout";
import {
  hasVariants,
  listColors,
  variantsForColor,
  type ProductVariant,
} from "@/app/lib/variants";
import type { Product } from "@/app/product-data";

type ProductDetailProps = {
  product: Product;
};

export default function ProductDetail({ product }: ProductDetailProps) {
  const [buyingNow, setBuyingNow] = useState(false);

  const cartProducts = useCartStore((s) => s.cartProducts);
  const addToCart = useCartStore((s) => s.addToCart);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const isLoading = useCartStore((s) => s.isLoading);

  const { startCheckout, loading: checkoutLoading } = useCheckout();

  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const isVariantProduct = hasVariants(product);
  const colors = useMemo(() => listColors(variants), [variants]);

  // Opens on the first colourway that has something to sell, so the common
  // case needs one click (a size) rather than two.
  const [color, setColor] = useState<string>(
    () =>
      colors.find((c) =>
        variantsForColor(variants, c).some((v) => v.stock > 0)
      ) ??
      colors[0] ??
      ""
  );
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  const sizesForColor = useMemo(
    () => (color ? variantsForColor(variants, color) : []),
    [variants, color]
  );

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
  const inCart = cartProducts.some(
    (p) => p.id === product.id && (p.variantSku ?? undefined) === sku
  );
  const loading = isLoading(product.id, sku);

  /** The exact line being added: product plus the chosen size and colour. */
  function lineToAdd(): Product {
    if (!selected) return product;
    return {
      ...product,
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
      return selected.stock <= 5
        ? `Only ${selected.stock} left in EU ${selected.size}`
        : `${selected.stock} in stock in EU ${selected.size}`;
    }
    if (outOfStock) return "Out of stock";
    return product.stock <= 5
      ? `Only ${product.stock} left`
      : `${product.stock} in stock`;
  }

  const stockToneClass =
    outOfStock || (isVariantProduct && selected && selected.stock < 1)
      ? "text-red-600"
      : availableStock > 0 && availableStock <= 5
        ? "text-amber-600"
        : "text-gray-600";

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <CartErrorBanner />
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-1/2 p-8 bg-gray-100 flex items-center justify-center">
              <div className="relative w-full aspect-square max-w-md">
                <Image
                  src={getImageSrc(product.imageUrl)}
                  alt={product.name}
                  fill
                  className="object-cover rounded-xl"
                  unoptimized
                  priority
                />
              </div>
            </div>

            <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
              <div className="mb-6">
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                  {product.name}
                </h1>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-blue-600">
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-gray-500 text-sm">USD</span>
                </div>
                <p className={`mt-3 text-sm font-medium ${stockToneClass}`}>
                  {stockMessage()}
                </p>
              </div>

              {isVariantProduct && (
                <div className="mb-8 space-y-6">
                  {colors.length > 1 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-gray-900">
                        Colour:{" "}
                        <span className="font-normal text-gray-600">{color}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((option) => {
                          const soldOut = variantsForColor(variants, option).every(
                            (v) => v.stock < 1
                          );
                          return (
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
                              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                                option === color
                                  ? "border-blue-600 bg-blue-50 text-blue-700"
                                  : "border-gray-300 text-gray-700 hover:border-gray-400"
                              } ${soldOut ? "opacity-50" : ""}`}
                            >
                              {option}
                              {soldOut && (
                                <span className="ml-1 text-xs text-gray-500">
                                  (sold out)
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-semibold text-gray-900">
                      EU size
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {sizesForColor.map((variant) => {
                        const soldOut = variant.stock < 1;
                        const isSelected = variant.sku === selectedSku;
                        return (
                          <button
                            key={variant.sku}
                            type="button"
                            disabled={soldOut}
                            aria-pressed={isSelected}
                            onClick={() => setSelectedSku(variant.sku)}
                            title={
                              soldOut
                                ? "Sold out"
                                : `${variant.stock} available`
                            }
                            className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                              isSelected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : soldOut
                                  ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 line-through"
                                  : "border-gray-300 text-gray-800 hover:border-gray-500"
                            }`}
                          >
                            {variant.size}
                          </button>
                        );
                      })}
                    </div>
                    {needsSelection && !outOfStock && (
                      <p className="mt-2 text-sm text-gray-500">
                        Choose your size to add this to the cart.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  Description
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
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
                  className={`flex-1 font-semibold py-4 px-8 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      inCart
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-blue-600 text-white hover:bg-blue-700"
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
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-8 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {buyingNow || checkoutLoading ? "Processing..." : "Buy Now"}
                </button>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="block font-semibold text-gray-900">
                      Free Shipping
                    </span>
                    <span>On orders over $50</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-gray-900">
                      Easy Returns
                    </span>
                    <span>30-day return policy</span>
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
