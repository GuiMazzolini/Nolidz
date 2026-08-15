import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructEventMock, fulfillMock, releaseMock } = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  fulfillMock: vi.fn(),
  releaseMock: vi.fn(),
}));

vi.mock("@/app/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: constructEventMock } }),
}));

vi.mock("@/app/lib/orders", () => ({
  fulfillCheckoutSession: fulfillMock,
  releaseHoldForSession: releaseMock,
}));

import { POST } from "@/app/api/webhooks/stripe/route";

function webhookRequest(signature: string | null = "t=1,v1=abc") {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: JSON.stringify({ id: "evt_1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  fulfillMock.mockResolvedValue({ paid: true, fulfilled: true });
});

describe("POST /api/webhooks/stripe", () => {
  it("fulfills a completed checkout session", async () => {
    constructEventMock.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1" } },
    });

    const res = await POST(webhookRequest());

    expect(res.status).toBe(200);
    expect(fulfillMock).toHaveBeenCalledWith("cs_test_1");
  });

  it("puts stock back when a checkout expires unpaid", async () => {
    const session = { id: "cs_test_1", metadata: { reservationId: "r1" } };
    constructEventMock.mockReturnValue({
      type: "checkout.session.expired",
      data: { object: session },
    });

    const res = await POST(webhookRequest());

    expect(res.status).toBe(200);
    expect(releaseMock).toHaveBeenCalledWith(session, "checkout.session.expired");
    expect(fulfillMock).not.toHaveBeenCalled();
  });

  it("puts stock back when a delayed payment fails", async () => {
    const session = { id: "cs_test_1", metadata: { reservationId: "r1" } };
    constructEventMock.mockReturnValue({
      type: "checkout.session.async_payment_failed",
      data: { object: session },
    });

    await POST(webhookRequest());

    expect(releaseMock).toHaveBeenCalledWith(
      session,
      "checkout.session.async_payment_failed"
    );
  });

  it("acknowledges other event types without fulfilling", async () => {
    constructEventMock.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1" } },
    });

    const res = await POST(webhookRequest());

    expect(res.status).toBe(200);
    expect(fulfillMock).not.toHaveBeenCalled();
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it("rejects a forged payload whose signature does not verify", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const res = await POST(webhookRequest());

    expect(res.status).toBe(400);
    expect(fulfillMock).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature header", async () => {
    const res = await POST(webhookRequest(null));

    expect(res.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("refuses to run unconfigured rather than accepting unverified events", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const res = await POST(webhookRequest());

    expect(res.status).toBe(501);
    expect(fulfillMock).not.toHaveBeenCalled();
  });
});
