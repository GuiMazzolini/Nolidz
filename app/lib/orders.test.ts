import { describe, expect, it } from "vitest";
import {
  buildOrderFromStripeSession,
  canAccessOrder,
  type Order,
} from "@/app/lib/orders";
import type Stripe from "stripe";

function fakeSession(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    amount_subtotal: 2500,
    amount_total: 3000,
    currency: "eur",
    customer_details: {
      email: "guest@example.com",
      name: "Guest Buyer",
      address: null,
      phone: null,
      tax_exempt: "none",
      tax_ids: [],
    },
    customer_email: null,
    total_details: {
      amount_discount: 0,
      amount_shipping: 500,
      amount_tax: 0,
    },
    collected_information: {
      shipping_details: {
        name: "Guest Buyer",
        address: {
          line1: "1 Main St",
          line2: null,
          city: "Austin",
          state: "TX",
          postal_code: "78701",
          country: "US",
        },
      },
    },
    line_items: {
      object: "list",
      data: [
        {
          id: "li_1",
          object: "item",
          description: "Hat",
          quantity: 2,
          price: {
            id: "price_1",
            object: "price",
            unit_amount: 1250,
          } as Stripe.Price,
        } as Stripe.LineItem,
      ],
      has_more: false,
      url: "",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

/**
 * Stripe's ShippingRate has a dozen fields this code never reads, so the
 * fixture states only the ones under test and casts past the full shape.
 */
function withShippingRate(rate: unknown): Partial<Stripe.Checkout.Session> {
  return { shipping_cost: { shipping_rate: rate } } as unknown as Partial<
    Stripe.Checkout.Session
  >;
}

describe("buildOrderFromStripeSession", () => {
  it("maps Stripe money and shipping into a persisted order shape", () => {
    const order = buildOrderFromStripeSession(
      fakeSession(),
      "guest@example.com"
    );

    expect(order.stripeSessionId).toBe("cs_test_123");
    expect(order.userId).toBe("guest@example.com");
    expect(order.customerEmail).toBe("guest@example.com");
    expect(order.items).toEqual([
      { name: "Hat", quantity: 2, unitAmount: 12.5 },
    ]);
    expect(order.subtotal).toBe(25);
    expect(order.shippingCost).toBe(5);
    expect(order.total).toBe(30);
    expect(order.shippingAddress?.city).toBe("Austin");
    expect(order.status).toBe("paid");
    expect(order.trackingNumber).toBeNull();
    // No rate metadata to read, so it lands on standard and standard's carrier.
    expect(order.shippingMethod).toBe("standard");
    expect(order.carrier).toBe("DHL");
    expect(order.shippedAt).toBeNull();
  });

  /**
   * The rate's metadata is the only durable record of what the buyer picked —
   * display names are translated copy and Stripe reports the amount, not the
   * choice behind it.
   */
  it("reads the chosen method from the expanded shipping rate", () => {
    const order = buildOrderFromStripeSession(
      fakeSession(
        withShippingRate({
          id: "shr_1",
          object: "shipping_rate",
          metadata: { methodId: "express", carrier: "DHL Express" },
        })
      ),
      "guest@example.com"
    );

    expect(order.shippingMethod).toBe("express");
    // Prefilled so tracking knows who to ask before anyone opens the ship form.
    expect(order.carrier).toBe("DHL Express");
  });

  /**
   * Orders placed before buyers had a choice, and any session retrieved
   * without expanding the rate, must not be dropped or guessed at.
   */
  it("falls back to standard when no method can be read", () => {
    expect(buildOrderFromStripeSession(fakeSession(), "g@example.com").shippingMethod)
      .toBe("standard");

    const unexpanded = buildOrderFromStripeSession(
      fakeSession(withShippingRate("shr_1")),
      "g@example.com"
    );
    expect(unexpanded.shippingMethod).toBe("standard");
  });

  it("ignores a method id that is not one we offer", () => {
    const order = buildOrderFromStripeSession(
      fakeSession(
        withShippingRate({ id: "shr_1", metadata: { methodId: "teleport" } })
      ),
      "g@example.com"
    );
    expect(order.shippingMethod).toBe("standard");
  });
});

describe("canAccessOrder", () => {
  const order: Pick<Order, "userId" | "customerEmail"> = {
    userId: "owner@example.com",
    customerEmail: "guest@example.com",
  };

  it("allows the logged-in order owner", () => {
    expect(
      canAccessOrder(order, { sessionEmail: "owner@example.com" })
    ).toBe(true);
  });

  it("allows the owner when Stripe recorded a different email casing", () => {
    // userId can come from Stripe's customer_details.email, which is whatever
    // the buyer typed — comparing it exactly locked owners out of their orders.
    expect(
      canAccessOrder(
        { userId: "Owner@Example.COM", customerEmail: null },
        { sessionEmail: "owner@example.com" }
      )
    ).toBe(true);
  });

  it("allows guests who know the checkout email", () => {
    expect(
      canAccessOrder(order, { guestEmail: "Guest@Example.com" })
    ).toBe(true);
  });

  it("denies unrelated viewers", () => {
    expect(
      canAccessOrder(order, {
        sessionEmail: "other@example.com",
        guestEmail: "wrong@example.com",
      })
    ).toBe(false);
  });
});
