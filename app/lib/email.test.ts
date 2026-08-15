import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import {
  sendOrderConfirmationEmail,
  sendShippingNotificationEmail,
} from "@/app/lib/email";
import { formatMoney } from "@/app/lib/money";
import type { Order } from "@/app/lib/orders";

const order: Order = {
  stripeSessionId: "cs_1",
  userId: "buyer@example.com",
  customerEmail: "buyer@example.com",
  items: [
    { name: "Runner — EU 42 · Black", quantity: 2, unitAmount: 89.99 },
    { name: "Mug", quantity: 1, unitAmount: 14.99 },
  ],
  subtotal: 194.97,
  shippingCost: 0,
  total: 194.97,
  currency: "eur",
  shippingAddress: {
    name: "Buyer",
    line1: "1 Main St",
    line2: null,
    city: "Lisbon",
    state: null,
    postalCode: "1000-001",
    country: "PT",
  },
  status: "paid",
  trackingNumber: null,
  carrier: null,
  shippedAt: null,
  createdAt: new Date("2026-06-01"),
};

function sentEmail() {
  return sendMock.mock.calls.at(-1)![0] as {
    to: string;
    from: string;
    subject: string;
    html: string;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ id: "email_1" });
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM_EMAIL", "");
});

describe("order confirmation email", () => {
  it("lists each line with its size and colour", async () => {
    await sendOrderConfirmationEmail(order);

    const email = sentEmail();
    expect(email.to).toBe("buyer@example.com");
    expect(email.html).toContain("Runner — EU 42 · Black");
    expect(email.html).toContain(formatMoney(179.98));
    expect(email.subject).toContain(formatMoney(194.97));
  });

  it("includes the shipping address when there is one", async () => {
    await sendOrderConfirmationEmail(order);
    expect(sentEmail().html).toContain("1 Main St");
  });

  it("no-ops when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await sendOrderConfirmationEmail(order);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("no-ops when the order has no email address", async () => {
    await sendOrderConfirmationEmail({ ...order, customerEmail: null });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("swallows a provider failure so fulfillment is not blocked", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMock.mockRejectedValue(new Error("resend down"));

    await expect(sendOrderConfirmationEmail(order)).resolves.toBeUndefined();
    error.mockRestore();
  });
});

describe("shipping notification email", () => {
  const shipped: Order = {
    ...order,
    status: "shipped",
    trackingNumber: "TRACK123",
    carrier: "DHL",
    shippedAt: new Date("2026-06-02"),
  };

  it("includes the tracking number and carrier", async () => {
    await sendShippingNotificationEmail(shipped);

    const email = sentEmail();
    expect(email.html).toContain("TRACK123");
    expect(email.html).toContain("DHL");
  });

  it("does not send without a tracking number", async () => {
    await sendShippingNotificationEmail({ ...shipped, trackingNumber: null });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("no-ops when Resend is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await sendShippingNotificationEmail(shipped);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
