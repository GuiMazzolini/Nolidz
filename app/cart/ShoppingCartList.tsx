"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/app/lib/money";
import { useSession } from "next-auth/react";
import { Product } from "../product-data";
import Link from "next/link";
import CartItem from "../components/CartItem";
import CartErrorBanner from "../components/CartErrorBanner";
import { useCartStore } from "../lib/store/cartStore";
import { cartLineKey } from "../lib/variants";
import { CHECKOUT_HOLD_MINUTES } from "../lib/reservations";
import { useCheckout } from "../lib/use-checkout";
import {
  FREE_SHIPPING_THRESHOLD,
  getOrderTotal,
  getShippingCost,
} from "../lib/shipping";

export default function ShoppingCartList({ initialCartProducts }: { initialCartProducts: Product[] }) {
  const { status } = useSession();
  const isGuest = status === "unauthenticated";
  const { startCheckout, loading: checkoutLoading, error: checkoutError } = useCheckout();

  const storeCart = useCartStore((s) => s.cartProducts);
  const setCart = useCartStore((s) => s.setCart);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    // Unconditional, so emptying the cart on another device propagates here
    // instead of leaving stale items on screen.
    if (status === "authenticated") {
      setCart(initialCartProducts);
    }
    // Deliberate hydration flag: exactly one extra render once the client store
    // is authoritative. Without it the first paint reads an empty store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSynced(true);
  }, [status, initialCartProducts, setCart]);

  // Until the store is synced, render the server's snapshot. Reading the store
  // straight away would paint "your cart is empty" on every load and then flip
  // — on the page the customer pays from.
  const cartProducts = synced ? storeCart : initialCartProducts;

  const subtotal = cartProducts.reduce(
    (sum, p) => sum + p.price * (p.quantity || 1),
    0
  );
  const totalItems = cartProducts.reduce((sum, p) => sum + (p.quantity || 1), 0);
  const shipping = getShippingCost(subtotal);
  const total = getOrderTotal(subtotal);
  const remainingForFreeShipping = FREE_SHIPPING_THRESHOLD - subtotal;

  if (cartProducts.length === 0) {
    return (
      <div className="min-h-screen bg-paper py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white border-2 border-ink/10 p-12 text-center">
            <h2 className="font-display italic font-extrabold text-3xl text-ink mb-4">
              Your cart is empty
            </h2>
            <p className="text-ink/60 mb-8">
              Looks like you haven&apos;t added any items yet.
            </p>
            <Link
              href="/products"
              className="inline-block bg-ink text-paper px-8 py-3 font-semibold hover:bg-ink/85 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <p className="text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm mb-2">
          Checkout
        </p>
        <h1 className="font-display italic font-extrabold text-4xl text-ink mb-8 tracking-tight">
          Shopping Cart
        </h1>

        <CartErrorBanner />

        {isGuest && (
          <p className="mb-6 border-2 border-cardboard/40 bg-white px-4 py-3 text-sm text-ink/80">
            You&apos;re shopping as a guest — you can checkout without an account.{" "}
            <Link
              href="/login?callbackUrl=/cart"
              className="font-semibold text-cardboard-dark underline hover:text-ink"
            >
              Log in
            </Link>{" "}
            to save your cart across devices and view order history.
          </p>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartProducts.map((product) => (
              <CartItem
                key={cartLineKey(product.id, product.variantSku)}
                product={product}
              />
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white border-2 border-ink/10 p-6 sticky top-8">
              <h2 className="font-display italic font-extrabold text-2xl text-ink mb-6">
                Order Summary
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-ink/65">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>

                <div className="flex justify-between text-ink/65">
                  <span>Shipping</span>
                  {shipping === 0 ? (
                    <span className="text-green-700 font-semibold">FREE</span>
                  ) : (
                    <span>{formatMoney(shipping)}</span>
                  )}
                </div>

                {remainingForFreeShipping > 0 && (
                  <p className="text-sm text-ink/50">
                    Add {formatMoney(remainingForFreeShipping)} more for free shipping.
                  </p>
                )}

                <div className="border-t-2 border-ink/10 pt-4">
                  <div className="flex justify-between text-xl font-bold text-ink">
                    <span>Total</span>
                    <span className="font-display italic text-cardboard-dark">
                      {formatMoney(total)}
                    </span>
                  </div>
                </div>
              </div>

              {checkoutError && (
                <p className="mb-4 text-sm text-red-600" role="alert">
                  {checkoutError}
                </p>
              )}

              <button
                type="button"
                onClick={startCheckout}
                disabled={checkoutLoading}
                className="block text-center w-full bg-ink text-paper py-4 font-semibold hover:bg-ink/85 transition-colors mb-2 disabled:opacity-60 disabled:pointer-events-none"
              >
                {checkoutLoading ? "Redirecting…" : "Pay with Stripe"}
              </button>

              <p className="mb-4 text-center text-xs text-ink/45">
                Secure payment on Stripe. {isGuest && "No account needed — "}
                shipping and email are collected there.
              </p>

              <p className="mb-4 bg-paper px-3 py-2 text-xs text-ink/60">
                Popular sizes go quickly — your basket doesn&apos;t hold them.
                We&apos;ll set your size aside for {CHECKOUT_HOLD_MINUTES}{" "}
                minutes once you continue to payment.
              </p>

              <Link
                href="/products"
                className="block w-full text-center border-2 border-ink/15 text-ink py-3 font-semibold hover:border-cardboard-dark transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
