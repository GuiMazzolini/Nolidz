import { beforeEach, describe, expect, it, vi } from "vitest";

const { markOrderShippedMock } = vi.hoisted(() => ({
  markOrderShippedMock: vi.fn(),
}));

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/app/lib/orders", () => ({ markOrderShipped: markOrderShippedMock }));

import { PATCH } from "@/app/api/admin/orders/[sessionId]/route";
import { ADMIN, BUYER } from "@/app/test/fixtures";
import { jsonRequest, malformedRequest, readResponse } from "@/app/test/http";
import { setMockSession } from "@/app/test/session";

function params(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

const shippedOrder = {
  stripeSessionId: "cs_1",
  status: "shipped",
  trackingNumber: "TRACK123",
  carrier: "DHL",
  shippedAt: new Date("2026-06-01"),
  customerEmail: BUYER,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  markOrderShippedMock.mockResolvedValue(shippedOrder);
  setMockSession(ADMIN);
});

describe("PATCH /api/admin/orders/[sessionId]", () => {
  it("marks an order shipped and reports the email went out", async () => {
    const { status, body } = await readResponse<{ emailSent: boolean }>(
      await PATCH(
        jsonRequest("PATCH", { trackingNumber: "TRACK123", carrier: "DHL" }),
        params("cs_1")
      )
    );

    expect(status).toBe(200);
    expect(body.emailSent).toBe(true);
    expect(markOrderShippedMock).toHaveBeenCalledWith({
      sessionId: "cs_1",
      trackingNumber: "TRACK123",
      carrier: "DHL",
      sendEmail: true,
    });
  });

  it("honours sendEmail: false", async () => {
    const { body } = await readResponse<{ emailSent: boolean }>(
      await PATCH(
        jsonRequest("PATCH", { trackingNumber: "T1", sendEmail: false }),
        params("cs_1")
      )
    );

    expect(body.emailSent).toBe(false);
    expect(markOrderShippedMock).toHaveBeenCalledWith(
      expect.objectContaining({ sendEmail: false })
    );
  });

  it("locks out non-admins", async () => {
    setMockSession(BUYER);
    const res = await PATCH(
      jsonRequest("PATCH", { trackingNumber: "T1" }),
      params("cs_1")
    );

    expect(res.status).toBe(401);
    expect(markOrderShippedMock).not.toHaveBeenCalled();
  });

  it("requires a non-blank tracking number", async () => {
    for (const trackingNumber of ["", "   ", 42, undefined]) {
      const res = await PATCH(
        jsonRequest("PATCH", { trackingNumber }),
        params("cs_1")
      );
      expect(res.status).toBe(400);
    }
    expect(markOrderShippedMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const res = await PATCH(malformedRequest("PATCH"), params("cs_1"));
    expect(res.status).toBe(400);
  });

  it("404s an order that does not exist", async () => {
    markOrderShippedMock.mockResolvedValue(null);

    const res = await PATCH(
      jsonRequest("PATCH", { trackingNumber: "T1" }),
      params("cs_missing")
    );
    expect(res.status).toBe(404);
  });

  it("surfaces a failure as a 400 rather than a crash", async () => {
    markOrderShippedMock.mockRejectedValue(new Error("Tracking number is required"));

    const { status, body } = await readResponse<{ error: string }>(
      await PATCH(jsonRequest("PATCH", { trackingNumber: "T1" }), params("cs_1"))
    );

    expect(status).toBe(400);
    expect(body.error).toBe("Tracking number is required");
  });
});
