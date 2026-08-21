"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/app/lib/money";
import { useSession } from "next-auth/react";
import { Product } from "@/app/product-data";
import Link from "@/app/i18n/Link";
import CartItem from "@/app/components/CartItem";
import CartErrorBanner from "@/app/components/CartErrorBanner";
import { useCartStore } from "@/app/lib/store/cartStore";
import { cartLineKey } from "@/app/lib/variants";
import { CHECKOUT_HOLD_MINUTES } from "@/app/lib/reservations";
import { useCheckout } from "@/app/lib/use-checkout";
import {
  FREE_SHIPPING_THRESHOLD,
  getOrderTotal,
  getShippingCost,
} from "@/app/lib/shipping";
import { useLocale, useT } from "@/app/i18n/client";

export default function ShoppingCartList({ initialCartProducts }: { initialCartProducts: Product[] }) {
  const t = useT();
  const locale = useLocale();
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
  const money = (amount: number) => formatMoney(amount, undefined, locale);
  const area = t.common.shippingArea;

  if (cartProducts.length === 0) {
    return (
      <div className="min-h-screen bg-paper py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white border-2 border-ink/10 p-12 text-center">
            <h2 className="font-display italic font-extrabold text-3xl text-ink mb-4">
              {t.cart.emptyHeading}
            </h2>
            <p className="text-ink/60 mb-8">{t.cart.emptyBody}</p>
            <Link
              href="/products"
              className="inline-block bg-ink text-paper px-8 py-3 font-semibold hover:bg-ink/85 transition-colors"
            >
              {t.common.continueShopping}
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
          {t.cart.eyebrow}
        </p>
        <h1 className="font-display italic font-extrabold text-4xl text-ink mb-8 tracking-tight">
          {t.cart.heading}
        </h1>

        <CartErrorBanner />

        {isGuest && (
          <p className="mb-6 border-2 border-cardboard/40 bg-white px-4 py-3 text-sm text-ink/80">
            {t.cart.guestNoticeLead}{" "}
            <Link
              href="/login?callbackUrl=/cart"
              className="font-semibold text-cardboard-dark underline hover:text-ink"
            >
              {t.cart.guestNoticeLogIn}
            </Link>
            {/* The tail carries its own leading punctuation: English needs a
                space before "to save…", German a comma before ", um …". */}
            {t.cart.guestNoticeTail}
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
                {t.cart.orderSummary}
              </h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-ink/65">
                  <span>{t.cart.subtotal(totalItems)}</span>
                  <span>{money(subtotal)}</span>
                </div>

                <div className="flex justify-between text-ink/65">
                  <span>{t.cart.shipping}</span>
                  {shipping === 0 ? (
                    <span className="text-green-700 font-semibold">
                      {t.common.free}
                    </span>
                  ) : (
                    <span>{money(shipping)}</span>
                  )}
                </div>

                <p className="text-sm text-ink/50">
                  {t.cart.shippingStandardNote}
                </p>

                {remainingForFreeShipping > 0 && (
                  <p className="text-sm text-ink/65">
                    {t.cart.freeShippingHint(money(remainingForFreeShipping))}
                  </p>
                )}

                <div className="border-t-2 border-ink/10 pt-4">
                  <div className="flex justify-between text-xl font-bold text-ink">
                    <span>{t.cart.total}</span>
                    <span className="font-display italic text-cardboard-dark">
                      {money(total)}
                    </span>
                  </div>
                </div>
              </div>

              {checkoutError && (
                <p className="mb-4 text-sm text-red-600" role="alert">
                  {checkoutError}
                </p>
              )}

              {/* Above the button, not in the small print under it: the one
                  thing that can end this purchase outright is where it ships,
                  and Checkout is the wrong place to learn it. */}
              <p className="mb-3 border-2 border-ink/10 bg-paper px-3 py-2 text-sm text-ink/75">
                <span className="font-semibold text-ink">
                  {t.cart.deliveryOnly(area)}
                </span>{" "}
                {t.cart.deliveryOnlyTail(area)}
              </p>

              <button
                type="button"
                onClick={startCheckout}
                disabled={checkoutLoading}
                className="block text-center w-full bg-ink text-paper py-4 font-semibold hover:bg-ink/85 transition-colors mb-2 disabled:opacity-60 disabled:pointer-events-none"
              >
                {checkoutLoading ? t.cart.redirecting : t.cart.payButton}
              </button>

              <p className="mb-4 text-center text-xs text-ink/65">
                {t.cart.secureCheckout}{" "}
                {isGuest && t.cart.secureCheckoutGuest}
                {t.cart.secureCheckoutTail}
              </p>

              <p className="mb-4 bg-paper px-3 py-2 text-xs text-ink/60">
                {t.cart.holdNotice(CHECKOUT_HOLD_MINUTES)}
              </p>

              <Link
                href="/products"
                className="block w-full text-center border-2 border-ink/15 text-ink py-3 font-semibold hover:border-cardboard-dark transition-colors"
              >
                {t.common.continueShopping}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
