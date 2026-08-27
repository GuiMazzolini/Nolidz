import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The purchase, end to end, through the real route handlers.
 *
 * Every other test in the suite proves one piece: that the cart matches the
 * right variant, that a hold cannot be released twice, that fulfillment is
 * idempotent. None of them notices when the pieces stop meeting each other —
 * a webhook that never reaches fulfillment leaves the stock held, the product
 * off the storefront and the buyer with no order to look up, and every
 * individual test still passes. That is the failure this file is here to
 * catch.
 *
 * The steps share state and run in the order they are written: each `it` is a
 * step of one journey, not an independent case. Only the boundaries are faked
 * — Stripe, the Cloudinary upload, and email — and Stripe hands back the very
 * session our checkout route asked it to create, so the webhook settles
 * against the metadata we really produced rather than a hand-written copy.
 */

const { createSession, retrieveSession, constructEvent, confirmationEmail } =
  vi.hoisted(() => ({
    createSession: vi.fn(),
    retrieveSession: vi.fn(),
    constructEvent: vi.fn(),
    confirmationEmail: vi.fn(),
  }));

// Only `getServerSession` is stubbed; the real authOptions are left alone so
// the sign-in step below can run the credentials provider we actually ship.
vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: createSession, retrieve: retrieveSession } },
    webhooks: { constructEvent },
  }),
  getAppUrl: () => "http://localhost:3000",
}));

vi.mock("@/app/lib/email", () => ({
  sendOrderConfirmationEmail: confirmationEmail,
  sendShippingNotificationEmail: vi.fn(),
}));

import { POST as register } from "@/app/api/auth/register/route";
import { POST as createProduct } from "@/app/api/admin/products/route";
import { POST as signUpload } from "@/app/api/admin/uploads/sign/route";
import { PATCH as setCartQuantity, POST as addToCart } from "@/app/api/cart/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { authOptions } from "@/app/lib/auth";
import type { CartDoc, ProductDoc } from "@/app/lib/db-collections";
import { getAccessibleOrder } from "@/app/lib/orders";
import { isSellableForPublic } from "@/app/lib/public-products";
import type { ReservationDoc } from "@/app/lib/reservations";
import { heldStockFor } from "@/app/lib/stock-hold";
import { ADMIN, BUYER } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import {
  getIntegrationMongo,
  useTestDatabase,
  type TestDatabase,
} from "@/app/test/mongo-integration";
import { setMockSession } from "@/app/test/session";

const mongoUri = await getIntegrationMongo();
let test: TestDatabase;

const PASSWORD = "correct horse battery";
const GUEST = "guest@example.com";
const PRODUCT_ID = "court-white";
const IMAGE = "https://res.cloudinary.com/demo/image/upload/court-white.png";
const STARTING_STOCK = 5;

/** What the checkout route asked Stripe to create, keyed by session id. */
type CreateArgs = {
  client_reference_id?: string;
  metadata?: Record<string, string>;
  line_items: {
    quantity: number;
    price_data: { unit_amount: number; product_data: { name: string } };
  }[];
  shipping_options: {
    shipping_rate_data: {
      fixed_amount: { amount: number };
      metadata: Record<string, string>;
    };
  }[];
};

const sessionArgs = new Map<string, CreateArgs>();
let sessionCounter = 0;

createSession.mockImplementation(async (args: CreateArgs) => {
  const id = `cs_test_smoke${++sessionCounter}`;
  sessionArgs.set(id, args);
  return { id, url: `https://checkout.stripe.com/c/pay/${id}` };
});

// The signature itself is Stripe's to check; what matters here is that the
// route parses the body it was posted and routes on the event type.
constructEvent.mockImplementation((body: string) => JSON.parse(body));

/**
 * The session Stripe reports as paid, built from what we asked it to create.
 * Amounts, line items and the shipping rate are derived rather than typed out,
 * so a change to how checkout prices a basket shows up in the order here.
 */
function paidSession(sessionId: string, email: string) {
  const args = sessionArgs.get(sessionId)!;
  const subtotal = args.line_items.reduce(
    (sum, line) => sum + line.price_data.unit_amount * line.quantity,
    0
  );
  // Standard delivery: the first option, which is the one Stripe preselects.
  const rate = args.shipping_options[0].shipping_rate_data;

  return {
    id: sessionId,
    payment_status: "paid",
    currency: "eur",
    amount_subtotal: subtotal,
    amount_total: subtotal + rate.fixed_amount.amount,
    total_details: { amount_shipping: rate.fixed_amount.amount },
    client_reference_id: args.client_reference_id ?? null,
    customer_details: { email },
    collected_information: {
      shipping_details: {
        name: "Test Buyer",
        address: {
          line1: "Hauptstrasse 1",
          line2: null,
          city: "Berlin",
          state: null,
          postal_code: "10115",
          country: "DE",
        },
      },
    },
    line_items: {
      data: args.line_items.map((line) => ({
        description: line.price_data.product_data.name,
        quantity: line.quantity,
        price: { unit_amount: line.price_data.unit_amount },
      })),
    },
    shipping_cost: { shipping_rate: { metadata: rate.metadata } },
    metadata: args.metadata ?? {},
  };
}

/** The id of the session checkout just asked Stripe to create. */
async function lastSessionId(): Promise<string> {
  const created = await createSession.mock.results.at(-1)!.value;
  return created.id as string;
}

function webhookRequest(type: string, object: unknown): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=stub" },
    body: JSON.stringify({ type, data: { object } }),
  });
}

async function storedProduct(): Promise<ProductDoc> {
  return (await test.db
    .collection<ProductDoc>("products")
    .findOne({ id: PRODUCT_ID })) as ProductDoc;
}

/** Stock still on sale. Anything held by an open checkout is already gone. */
async function availableStock(): Promise<number> {
  return (await storedProduct()).stock;
}

async function reservationFor(sessionId: string): Promise<ReservationDoc> {
  return (await test.db
    .collection<ReservationDoc>("reservations")
    .findOne({ stripeSessionId: sessionId })) as ReservationDoc;
}

async function orderCount(): Promise<number> {
  return test.db.collection("orders").countDocuments();
}

/**
 * The credentials provider as NextAuth would call it on the login form. The
 * function we passed lives under `options` — the top-level `authorize` is the
 * library's inert default, as auth.test.ts explains at more length.
 */
async function signIn(email: string, password: string) {
  const provider = authOptions.providers.find(
    (candidate) => candidate.id === "credentials"
  ) as unknown as {
    options: {
      authorize: (
        credentials: Record<string, string>,
        req: { headers: Record<string, string> }
      ) => Promise<{ email?: string | null } | null>;
    };
  };

  return provider.options.authorize(
    { email, password },
    { headers: { "x-forwarded-for": "203.0.113.1" } }
  );
}

/** Settings the journey needs, restored one by one when it finishes. */
const ENV = {
  ADMIN_EMAILS: ADMIN,
  // Set, so the success page leaves fulfillment to the webhook — the
  // arrangement in production, and the one being exercised here.
  STRIPE_WEBHOOK_SECRET: "whsec_smoke",
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "111111111111111",
  CLOUDINARY_API_SECRET: "smoke-secret",
};

describe.skipIf(!mongoUri)("smoke: signup to order confirmation", () => {
  const original = Object.fromEntries(
    Object.keys(ENV).map((key) => [key, process.env[key]])
  );

  beforeAll(async () => {
    test = await useTestDatabase("smoke", mongoUri!);
    Object.assign(process.env, ENV);
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await test?.teardown();
  });

  describe("account", () => {
    it("signs a new customer up", async () => {
      const { status } = await readResponse(
        await register(
          jsonRequest("POST", { name: "Test Buyer", email: BUYER, password: PASSWORD })
        )
      );

      expect(status).toBe(201);
      const user = await test.db.collection("users").findOne({ email: BUYER });
      expect(user).toBeTruthy();
      // Never the password itself, however the route is refactored.
      expect(user?.passwordHash).not.toBe(PASSWORD);
    });

    it("refuses a second account on the same email", async () => {
      const { status } = await readResponse(
        await register(
          jsonRequest("POST", { name: "Impostor", email: BUYER, password: PASSWORD })
        )
      );

      expect(status).toBe(409);
      expect(await test.db.collection("users").countDocuments({ email: BUYER })).toBe(1);
    });

    it("signs that customer in, and turns the wrong password away", async () => {
      await expect(signIn(BUYER, PASSWORD)).resolves.toMatchObject({ email: BUYER });
      await expect(signIn(BUYER, "not the password")).resolves.toBeNull();
    });
  });

  describe("admin publishes a product", () => {
    it("signs a Cloudinary upload for an admin and nobody else", async () => {
      setMockSession(BUYER);
      const asBuyer = await readResponse(await signUpload(jsonRequest("POST")));
      expect(asBuyer.status).toBe(401);

      setMockSession(ADMIN);
      const asAdmin = await readResponse<{
        cloudName: string;
        signature: string;
        folder: string;
      }>(await signUpload(jsonRequest("POST")));

      expect(asAdmin.status).toBe(200);
      expect(asAdmin.body.cloudName).toBe("demo");
      expect(asAdmin.body.signature).toMatch(/^[a-f0-9]{40}$/);
      // The secret signs the upload; it must never travel to the browser.
      expect(JSON.stringify(asAdmin.body)).not.toContain("smoke-secret");
    });

    it("rejects an image hosted anywhere but the allowlist", async () => {
      setMockSession(ADMIN);
      const { status } = await readResponse(
        await createProduct(
          jsonRequest("POST", {
            id: "elsewhere",
            name: "Elsewhere",
            description: "Off-allowlist photo",
            imageUrl: "https://images.example.com/shoe.png",
            price: 10,
            category: "men",
            stock: 1,
          })
        )
      );

      expect(status).toBe(400);
      expect(await test.db.collection("products").countDocuments()).toBe(0);
    });

    it("creates the product with its uploaded image", async () => {
      setMockSession(ADMIN);
      const { status, body } = await readResponse<{ id: string; imageUrl: string }>(
        await createProduct(
          jsonRequest("POST", {
            id: PRODUCT_ID,
            name: "Court White",
            description: "A clean court shoe",
            imageUrl: IMAGE,
            price: 89.99,
            category: "men",
            stock: STARTING_STOCK,
          })
        )
      );

      expect(status).toBe(201);
      expect(body.id).toBe(PRODUCT_ID);
      expect(body.imageUrl).toBe(IMAGE);

      const doc = await storedProduct();
      expect(doc.stock).toBe(STARTING_STOCK);
      expect(doc.imageUrl).toBe(IMAGE);
      // In stock, so the storefront lists it and the PDP opens.
      expect(isSellableForPublic(doc)).toBe(true);
    });
  });

  describe("a signed-in buyer checks out", () => {
    let sessionId: string;

    it("puts two pairs in the basket", async () => {
      setMockSession(BUYER);

      expect((await readResponse(await addToCart(
        jsonRequest("POST", { productId: PRODUCT_ID })
      ))).status).toBe(201);

      expect((await readResponse(await setCartQuantity(
        jsonRequest("PATCH", { productId: PRODUCT_ID, quantity: 2 })
      ))).status).toBe(200);

      const cart = await test.db
        .collection<CartDoc>("carts")
        .findOne({ userId: BUYER });
      expect(cart?.items).toEqual([{ productId: PRODUCT_ID, quantity: 2 }]);
    });

    it("takes the stock out of sale when checkout starts", async () => {
      setMockSession(BUYER);
      const { status, body } = await readResponse<{ url: string }>(
        await checkout(jsonRequest("POST"))
      );

      expect(status).toBe(200);
      expect(body.url).toContain("checkout.stripe.com");

      sessionId = await lastSessionId();

      // Available stock drops now, not at payment: two pairs are spoken for.
      expect(await availableStock()).toBe(STARTING_STOCK - 2);

      const hold = await reservationFor(sessionId);
      expect(hold.status).toBe("held");
      expect(hold.applied).toEqual([{ productId: PRODUCT_ID, quantity: 2 }]);

      // What the admin table reads: the shelf still has five, two of them
      // spoken for. Showing available there would look like stock vanished.
      const held = await heldStockFor(test.db, [PRODUCT_ID]);
      expect(held.get(PRODUCT_ID)?.total).toBe(2);
    });

    it("records the order when the paid webhook lands", async () => {
      const session = paidSession(sessionId, BUYER);
      retrieveSession.mockResolvedValue(session);

      const res = await stripeWebhook(
        webhookRequest("checkout.session.completed", session)
      );
      expect(res.status).toBe(200);

      expect(await orderCount()).toBe(1);
      const order = await getAccessibleOrder({ sessionId, sessionEmail: BUYER });
      expect(order).toMatchObject({
        stripeSessionId: sessionId,
        userId: BUYER,
        customerEmail: BUYER,
        status: "paid",
        currency: "eur",
        // Priced by our own shipping rules, not retyped here.
        subtotal: 179.98,
        shippingMethod: "standard",
        carrier: "DHL",
        locale: "en",
      });
      expect(order?.total).toBe(order!.subtotal + order!.shippingCost);
      expect(order?.items).toEqual([
        { name: "Court White", quantity: 2, unitAmount: 89.99 },
      ]);
      expect(order?.shippingAddress?.city).toBe("Berlin");

      // The hold closes without moving a counter — the stock left at checkout.
      expect((await reservationFor(sessionId)).status).toBe("committed");
      expect(await availableStock()).toBe(STARTING_STOCK - 2);

      const cart = await test.db
        .collection<CartDoc>("carts")
        .findOne({ userId: BUYER });
      expect(cart?.items).toEqual([]);
    });

    it("emails the confirmation once", async () => {
      expect(confirmationEmail).toHaveBeenCalledTimes(1);
      expect(confirmationEmail.mock.calls[0][0]).toMatchObject({
        stripeSessionId: sessionId,
        customerEmail: BUYER,
        locale: "en",
      });
    });

    it("shrugs off a webhook Stripe retries", async () => {
      const session = paidSession(sessionId, BUYER);
      retrieveSession.mockResolvedValue(session);

      const res = await stripeWebhook(
        webhookRequest("checkout.session.completed", session)
      );

      expect(res.status).toBe(200);
      expect(await orderCount()).toBe(1);
      expect(confirmationEmail).toHaveBeenCalledTimes(1);
      expect(await availableStock()).toBe(STARTING_STOCK - 2);
    });

    it("keeps the order to its owner", async () => {
      await expect(
        getAccessibleOrder({ sessionId, sessionEmail: "someone@else.test" })
      ).resolves.toBeNull();
    });
  });

  describe("a guest checks out and looks the order up", () => {
    let sessionId: string;

    it("holds stock for a checkout with no account behind it", async () => {
      setMockSession(null);
      const { status } = await readResponse<{ url: string }>(
        await checkout(
          jsonRequest("POST", { items: [{ productId: PRODUCT_ID, quantity: 1 }] })
        )
      );

      expect(status).toBe(200);
      sessionId = await lastSessionId();
      expect(await availableStock()).toBe(STARTING_STOCK - 3);
      expect((await reservationFor(sessionId)).status).toBe("held");
    });

    it("finds the order by email and reference, and only by the right ones", async () => {
      const session = paidSession(sessionId, GUEST);
      retrieveSession.mockResolvedValue(session);

      await stripeWebhook(webhookRequest("checkout.session.completed", session));

      expect(await orderCount()).toBe(2);
      // The guest order lookup page asks exactly this.
      await expect(
        getAccessibleOrder({ sessionId, guestEmail: GUEST })
      ).resolves.toMatchObject({ stripeSessionId: sessionId, total: expect.any(Number) });
      await expect(
        getAccessibleOrder({ sessionId, guestEmail: "wrong@example.com" })
      ).resolves.toBeNull();
      await expect(
        getAccessibleOrder({ sessionId: "cs_test_never", guestEmail: GUEST })
      ).resolves.toBeNull();
    });
  });

  describe("checkouts that never get paid", () => {
    it("puts the stock back when Stripe reports the session expired", async () => {
      setMockSession(null);
      await checkout(
        jsonRequest("POST", { items: [{ productId: PRODUCT_ID, quantity: 1 }] })
      );
      const sessionId = await lastSessionId();
      expect(await availableStock()).toBe(STARTING_STOCK - 4);

      const hold = await reservationFor(sessionId);
      const res = await stripeWebhook(
        webhookRequest("checkout.session.expired", {
          id: sessionId,
          metadata: { reservationId: hold.reservationId },
        })
      );

      expect(res.status).toBe(200);
      expect(await availableStock()).toBe(STARTING_STOCK - 3);
      expect((await reservationFor(sessionId)).status).toBe("released");
      expect(await orderCount()).toBe(2);
    });

    it("refuses a webhook it cannot verify, and fulfills nothing", async () => {
      constructEvent.mockImplementationOnce(() => {
        throw new Error("No signatures found matching the expected signature");
      });

      const res = await stripeWebhook(
        webhookRequest("checkout.session.completed", { id: "cs_test_forged" })
      );

      expect(res.status).toBe(400);
      expect(await orderCount()).toBe(2);
    });

    it("refuses an unsigned webhook", async () => {
      const res = await stripeWebhook(
        new Request("http://localhost:3000/api/webhooks/stripe", {
          method: "POST",
          body: JSON.stringify({ type: "checkout.session.completed" }),
        })
      );

      expect(res.status).toBe(400);
    });
  });

  it("leaves the product on sale with the unsold stock", async () => {
    const doc = await storedProduct();
    expect(doc.stock).toBe(STARTING_STOCK - 3);
    expect(isSellableForPublic(doc)).toBe(true);
  });
});
