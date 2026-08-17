import { connectToDB } from "@/app/api/db";
import { authOptions } from "@/app/lib/auth";
import { carts, products, users } from "@/app/lib/db-collections";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { STORE_CURRENCY } from "@/app/lib/money";
import { getAppUrl, getStripe } from "@/app/lib/stripe";
import { getShippingCost, SHIPPING_COUNTRIES } from "@/app/lib/shipping";
import { buildCartMetadata } from "@/app/lib/cart-metadata";
import { lineItemName } from "@/app/lib/variants";
import { MAX_CART_LINE_ITEMS } from "@/app/lib/schemas";
import { enforceRateLimit, getClientIp, RATE_LIMITS } from "@/app/lib/rate-limit";
import {
  CHECKOUT_HOLD_MINUTES,
  checkoutSessionExpiresAt,
  MAX_OPEN_HOLDS_PER_BUYER,
} from "@/app/lib/reservations";
import {
  attachSessionToHold,
  countOpenHolds,
  holdStock,
  releaseHold,
  sweepExpiredHolds,
} from "@/app/lib/stock-hold";
import {
  attachQuantitiesToProducts,
  describeCartLine,
  getCartStockError,
  parseGuestCheckoutItems,
  type CartItem,
} from "@/app/lib/checkout-cart";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(
    req,
    "checkout",
    RATE_LIMITS.checkout.limit,
    RATE_LIMITS.checkout.windowSec
  );
  if (limited) return limited;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;

  const { db } = await connectToDB();

  // Present only once a signed-in user has saved an address.
  let stripeCustomerId: string | undefined;

  let items: CartItem[] = [];
  if (email) {
    const [cart, user] = await Promise.all([
      carts(db).findOne({ userId: email }),
      users(db).findOne({ email }),
    ]);
    items = cart?.items || [];
    stripeCustomerId = user?.stripeCustomerId;
  } else {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const guestItems = parseGuestCheckoutItems(body);
    if (!guestItems) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    items = guestItems;
  }

  if (!items.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // A saved cart is not validated on read, so it can exceed the cap even
  // though the guest payload schema enforces it.
  if (items.length > MAX_CART_LINE_ITEMS) {
    return NextResponse.json(
      { error: `A cart can hold at most ${MAX_CART_LINE_ITEMS} different products` },
      { status: 400 }
    );
  }

  // Before anything reads stock. Holds from checkouts nobody paid for still
  // own their sizes, so sweeping after the read would show this customer a
  // sold-out message for stock that is about to come back on sale.
  try {
    await sweepExpiredHolds(db);
  } catch (err) {
    // A failed sweep must never stop a customer paying; the next one retries.
    console.error("Expired-hold sweep failed:", err);
  }

  const productIds = items.map((i) => i.productId);
  const productDocs = await products(db)
    .find({ id: { $in: productIds } })
    .toArray();

  // A read-only pass, kept for the message it produces: it can say "only 2 of
  // Runner (EU 42 · Black) left" and can catch a variant product with no size
  // chosen. It is not what makes checkout safe — the hold below is. Two
  // customers can both pass this check on the same last pair.
  const stockError = getCartStockError(items, productDocs);
  if (stockError) {
    return NextResponse.json({ error: stockError }, { status: 409 });
  }

  const cartProducts = attachQuantitiesToProducts(items, productDocs);

  if (cartProducts.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const origin = getAppUrl();

  // getStripe throws when STRIPE_SECRET_KEY is unset. Left uncaught it left
  // the route with an unhandled 500 and an empty body, so the client's
  // `res.json()` found no `error` to show and the buyer saw a button that
  // did nothing. Nothing is held yet at this point, so there is no stock to
  // give back — only a usable message to return.
  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("Stripe is not configured:", err);
    return NextResponse.json(
      { error: "Payments are not configured. Please contact us." },
      { status: 503 }
    );
  }

  const line_items = cartProducts.map((p) => {
    const image =
      p.imageUrl && !p.imageUrl.startsWith("http")
        ? [`${origin}/${p.imageUrl.replace(/^\//, "")}`]
        : p.imageUrl
          ? [p.imageUrl]
          : undefined;

    return {
      quantity: p.quantity,
      price_data: {
        currency: STORE_CURRENCY,
        unit_amount: Math.round(p.price * 100),
        product_data: {
          // The size and colour ride along in the name, so they appear on the
          // Stripe page, the receipt, and the order rows built from it.
          name: lineItemName(p.name, p.variantSize, p.variantColor),
          ...(image ? { images: image } : {}),
        },
      },
    };
  });

  const subtotal = cartProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const shippingCost = getShippingCost(subtotal);

  // Fulfillment decrements stock from this metadata, so a cart that cannot be
  // encoded in full is refused rather than checked out with lines missing.
  const cartMetadata = buildCartMetadata(
    cartProducts.map((p) => ({
      productId: p.id,
      quantity: p.quantity,
      variantSku: p.variantSku,
    }))
  );
  if (!cartMetadata) {
    return NextResponse.json(
      { error: "Cart is too large to check out. Please remove some items." },
      { status: 400 }
    );
  }

  // Holding stock is free, so without a cap one script can start checkouts all
  // day and keep the scarce sizes out of sale without ever paying.
  const holder = email ?? `ip:${getClientIp(req)}`;
  const openHolds = await countOpenHolds(db, holder);
  if (openHolds >= MAX_OPEN_HOLDS_PER_BUYER) {
    return NextResponse.json(
      {
        error: `You already have ${openHolds} checkouts open, and each one holds stock for ${CHECKOUT_HOLD_MINUTES} minutes. Finish or abandon one before starting another.`,
      },
      { status: 429 }
    );
  }

  // From here the stock is ours. Every path out of this function either hands
  // the customer a payable session or gives the stock back.
  const reservationId = randomUUID();
  const hold = await holdStock(db, {
    reservationId,
    lines: cartProducts.map((p) => ({
      productId: p.id,
      quantity: p.quantity,
      ...(p.variantSku ? { variantSku: p.variantSku } : {}),
    })),
    userId: email,
    holder,
  });

  if (!hold.ok) {
    const label = describeCartLine(
      productDocs.find((p) => p.id === hold.failed.productId),
      hold.failed.variantSku
    );
    return NextResponse.json(
      {
        error: `${label} sold out while you were checking out. Please update your basket.`,
      },
      { status: 409 }
    );
  }

  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      // Card + PayPal (enable PayPal under Dashboard → Payment methods).
      // Listing them here keeps Checkout aligned with what we support in the UI.
      payment_method_types: ["card", "paypal"],
      line_items,
      shipping_address_collection: {
        // Germany only — we do not deliver elsewhere.
        allowed_countries: [...SHIPPING_COUNTRIES],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: shippingCost === 0 ? "Free shipping" : "Standard shipping",
            fixed_amount: {
              amount: Math.round(shippingCost * 100),
              currency: STORE_CURRENCY,
            },
          },
        },
      ],
      // Bounds how long an abandoned checkout stays payable. Once stock is
      // held against this session, it also bounds how long that hold lasts.
      expires_at: checkoutSessionExpiresAt(),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      // Cancelling returns to the cart, which is now the only review step.
      cancel_url: `${origin}/cart`,
      ...(email
        ? {
            client_reference_id: email,
            // A Customer carries the saved shipping address, so Checkout
            // prefills it. Stripe rejects `customer` and `customer_email`
            // together, so only one is ever sent.
            ...(stripeCustomerId
              ? { customer: stripeCustomerId }
              : { customer_email: email }),
            metadata: { userId: email, reservationId, ...cartMetadata },
          }
        : {
            metadata: { isGuest: "true", reservationId, ...cartMetadata },
          }),
    });
  } catch (err) {
    console.error("Stripe checkout session creation failed:", err);
    await releaseHold(db, reservationId, "session-create-failed");
    return NextResponse.json(
      { error: "Payment provider is unavailable. Please try again." },
      { status: 502 }
    );
  }

  if (!checkoutSession.url) {
    await releaseHold(db, reservationId, "session-unusable");
    return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
  }

  // Not what fulfillment keys on — that reads reservationId straight from the
  // session metadata, so there is no window where a payment could arrive
  // before this write lands. Stored for support and admin lookups.
  await attachSessionToHold(db, reservationId, checkoutSession.id);

  return NextResponse.json({ url: checkoutSession.url });
}
