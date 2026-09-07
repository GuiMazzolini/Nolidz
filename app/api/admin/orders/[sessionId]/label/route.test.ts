import { beforeEach, describe, expect, it, vi } from "vitest";

const { createLabelMock } = vi.hoisted(() => ({
  createLabelMock: vi.fn(),
}));

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/app/lib/create-dhl-label", () => ({
  createLabelForOrder: createLabelMock,
}));

import { POST } from "@/app/api/admin/orders/[sessionId]/label/route";
import { ADMIN, BUYER } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { setMockSession } from "@/app/test/session";

function params(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  setMockSession(ADMIN);
  createLabelMock.mockResolvedValue({
    ok: true,
    created: true,
    emailSent: true,
    order: {
      stripeSessionId: "cs_1",
      status: "shipped",
      trackingNumber: "TRACK1",
      carrier: "DHL",
      shippedAt: new Date("2026-06-02"),
      labelUrl: "https://res.cloudinary.com/demo/raw/upload/label.pdf",
      dhlShipmentNo: "TRACK1",
      customerEmail: "buyer@example.com",
    },
  });
});

describe("POST /api/admin/orders/[sessionId]/label", () => {
  it("locks out non-admins", async () => {
    setMockSession(BUYER);
    expect((await POST(jsonRequest("POST"), params("cs_1"))).status).toBe(401);
    expect(createLabelMock).not.toHaveBeenCalled();
  });

  it("400s a blank order id", async () => {
    const { status } = await readResponse(
      await POST(jsonRequest("POST"), params(""))
    );
    expect(status).toBe(400);
    expect(createLabelMock).not.toHaveBeenCalled();
  });

  it("returns the created label payload", async () => {
    const { status, body } = await readResponse<{
      created: boolean;
      trackingNumber: string;
      labelUrl: string;
      emailSent: boolean;
    }>(await POST(jsonRequest("POST", { sendEmail: true }), params("cs_1")));

    expect(status).toBe(200);
    expect(body.created).toBe(true);
    expect(body.trackingNumber).toBe("TRACK1");
    expect(body.labelUrl).toContain("label.pdf");
    expect(body.emailSent).toBe(true);
    expect(createLabelMock).toHaveBeenCalledWith({
      sessionId: "cs_1",
      sendEmail: true,
      addressOverride: undefined,
      weightKg: undefined,
    });
  });

  it("forwards weightKg from the body", async () => {
    await POST(
      jsonRequest("POST", { sendEmail: false, weightKg: 1.5 }),
      params("cs_1")
    );
    expect(createLabelMock).toHaveBeenCalledWith({
      sessionId: "cs_1",
      sendEmail: false,
      addressOverride: undefined,
      weightKg: 1.5,
    });
  });

  it("maps not-configured to 503", async () => {
    createLabelMock.mockResolvedValue({ ok: false, reason: "not-configured" });
    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"), params("cs_1"))
    );
    expect(status).toBe(503);
    expect(body.error).toMatch(/credentials/i);
  });

  it("maps unsupported (express) to 400", async () => {
    createLabelMock.mockResolvedValue({ ok: false, reason: "unsupported" });
    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"), params("cs_1"))
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/Express/i);
  });

  it("maps validation failures with DHL detail", async () => {
    createLabelMock.mockResolvedValue({
      ok: false,
      reason: "validation",
      detail: "billing number invalid",
    });
    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"), params("cs_1"))
    );
    expect(status).toBe(400);
    expect(body.error).toBe("billing number invalid");
  });
});
