"use client";

import Link from "@/app/i18n/Link";
import { formatMoney } from "@/app/lib/money";
import Image from "next/image";
import { Product } from "../product-data";
import { MAX_CART_QUANTITY } from "../lib/cart-limits";
import { getImageSrc } from "../lib/images";
import { useCartStore } from "../lib/store/cartStore";
import { variantLabel } from "../lib/variants";
import { useLocale, useT } from "@/app/i18n/client";

interface CartItemProps {
  product: Product;
}

export default function CartItem({ product }: CartItemProps) {
  const t = useT();
  const locale = useLocale();
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const isLoading = useCartStore((s) => s.isLoading);

  const sku = product.variantSku;
  const loading = isLoading(product.id, sku);
  const label = variantLabel(product.variantSize, product.variantColor);
  const money = (amount: number) => formatMoney(amount, undefined, locale);
  const quantity = product.quantity || 1;
  const stock =
    typeof product.stock === "number" ? product.stock : MAX_CART_QUANTITY;
  const atLimit = quantity >= Math.min(MAX_CART_QUANTITY, stock);

  return (
    <div className="bg-white border-2 border-ink/10 overflow-hidden hover:border-cardboard transition-colors">
      <div className="flex flex-col sm:flex-row">
        <Link
          href={`/products/${product.id}`}
          className="sm:w-48 h-48 sm:h-auto relative bg-paper shrink-0"
        >
          <Image
            src={getImageSrc(product.imageUrl)}
            alt={product.name}
            fill
            unoptimized
            className="object-cover hover:scale-105 transition-transform duration-300"
          />
        </Link>

        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <Link href={`/products/${product.id}`} className="block">
              <h3 className="text-xl font-semibold text-ink hover:text-cardboard-dark transition-colors mb-2">
                {product.name}
              </h3>
            </Link>

            {label && (
              <p className="mb-2 inline-block bg-paper px-2 py-1 text-xs font-medium text-ink/70">
                {label}
              </p>
            )}

            <p className="text-ink/60 text-sm line-clamp-2 mb-2">
              {product.description}
            </p>
            {typeof product.stock === "number" && (
              <p
                className={`text-xs mb-4 ${
                  product.stock < 1
                    ? "text-red-600"
                    : quantity > product.stock
                      ? "text-amber-600"
                      : "text-ink/65"
                }`}
              >
                {product.stock < 1
                  ? t.cart.itemOutOfStock
                  : t.cart.itemAvailable(product.stock)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="font-display italic text-2xl font-bold text-cardboard-dark">
              {money(product.price * quantity)}

              {quantity > 1 && (
                <span className="text-sm text-ink/65 ml-2 not-italic font-sans font-normal">
                  {t.cart.eachPrice(money(product.price))}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center border-2 border-ink/15">
                {quantity <= 1 ? (
                  <button
                    onClick={() => removeFromCart(product.id, sku)}
                    disabled={loading}
                    aria-label={t.cart.removeFromCart}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    <svg
                      className="w-5 h-5"
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
                  </button>
                ) : (
                  <button
                    onClick={() => updateQuantity(product.id, quantity - 1, sku)}
                    disabled={loading}
                    aria-label={t.cart.decreaseQuantity}
                    className="px-3 py-2 hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                )}

                <span className="px-4 py-2 font-semibold min-w-12 text-center">
                  {loading ? "..." : quantity}
                </span>

                <button
                  onClick={() => updateQuantity(product.id, quantity + 1, sku)}
                  disabled={loading || atLimit}
                  aria-label={t.cart.increaseQuantity}
                  className="px-3 py-2 hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
