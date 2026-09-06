import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createPaketLabelMock,
  uploadLabelPdfMock,
  fetchLabelPdfBufferMock,
  shippingEmailMock,
} = vi.hoisted(() => ({
  createPaketLabelMock: vi.fn(),
  uploadLabelPdfMock: vi.fn(),
  fetchLabelPdfBufferMock: vi.fn(),
  shippingEmailMock: vi.fn(),
}));

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("@/app/lib/dhl-shipping", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/dhl-shipping")>();
  return {
    ...actual,
    isDhlShippingConfigured: () => true,
    createPaketLabel: createPaketLabelMock,
  };
});

vi.mock("@/app/lib/cloudinary", () => ({
  uploadLabelPdf: uploadLabelPdfMock,
  fetchLabelPdfBuffer: fetchLabelPdfBufferMock,
}));

vi.mock("@/app/lib/email", () => ({
  sendShippingNotificationEmail: shippingEmailMock,
}));

import { createLabelForOrder } from "@/app/lib/create-dhl-label";
import { testDb } from "@/app/test/mongo-double";

const address = {
  name: "Buyer",
  line1: "Schönleinstraße 1",
  line2: null,
  city: "Berlin",
  state: null,
  postalCode: "10967",
  country: "DE",
};

function seedPaidOrder(overrides: Record<string, unknown> = {}) {
  testDb.seed("orders", [
    {
      stripeSessionId: "cs_label_1",
      userId: "buyer@example.com",
      customerEmail: "buyer@example.com",
      items: [{ name: "Runner", quantity: 1, unitAmount: 89 }],
      subtotal: 89,
      shippingCost: 5,
      total: 94,
      currency: "eur",
      shippingAddress: address,
      status: "paid",
      shippingMethod: "standard",
      trackingNumber: null,
      carrier: "DHL",
      shippedAt: null,
      labelUrl: null,
      labelPublicId: null,
      dhlShipmentNo: null,
      tracking: null,
      locale: "de",
      createdAt: new Date("2026-06-01"),
      ...overrides,
    },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  testDb.reset();
  shippingEmailMock.mockResolvedValue(undefined);
  uploadLabelPdfMock.mockResolvedValue({
    url: "https://res.cloudinary.com/demo/raw/upload/v1/nolidz/labels/order.pdf",
    publicId: "nolidz/labels/order-cs_label_1",
  });
  createPaketLabelMock.mockResolvedValue({
    ok: true,
    label: {
      trackingNumber: "JD123",
      shipmentNo: "JD123",
      pdfBuffer: Buffer.from("%PDF-1.4 fake"),
      labelUrl: null,
    },
  });
});

describe("createLabelForOrder", () => {
  it("creates a label, stores PDF on the order, marks shipped and emails", async () => {
    seedPaidOrder();

    const result = await createLabelForOrder({ sessionId: "cs_label_1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.order.status).toBe("shipped");
    expect(result.order.trackingNumber).toBe("JD123");
    expect(result.order.labelPdfBase64).toBe(
      Buffer.from("%PDF-1.4 fake").toString("base64")
    );
    expect(result.emailSent).toBe(true);
    expect(shippingEmailMock).toHaveBeenCalled();
  });

  it("still succeeds if Cloudinary upload fails", async () => {
    seedPaidOrder();
    uploadLabelPdfMock.mockRejectedValue(new Error("cloudinary down"));

    const result = await createLabelForOrder({ sessionId: "cs_label_1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.labelPdfBase64).toBeTruthy();
    expect(result.order.labelUrl).toBeNull();
  });

  it("returns the existing label without calling DHL again", async () => {
    seedPaidOrder({
      status: "shipped",
      trackingNumber: "EXISTING",
      labelUrl: "https://example.com/existing.pdf",
      labelPdfBase64: "JVBERg==",
      dhlShipmentNo: "EXISTING",
    });

    const result = await createLabelForOrder({ sessionId: "cs_label_1" });

    expect(result).toMatchObject({
      ok: true,
      created: false,
      order: { trackingNumber: "EXISTING" },
    });
    expect(createPaketLabelMock).not.toHaveBeenCalled();
  });

  it("rejects orders that were already shipped manually", async () => {
    seedPaidOrder({
      status: "shipped",
      trackingNumber: "MANUAL1",
      labelUrl: null,
    });

    expect(await createLabelForOrder({ sessionId: "cs_label_1" })).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(createPaketLabelMock).not.toHaveBeenCalled();
  });

  it("rejects express orders", async () => {
    seedPaidOrder({ shippingMethod: "express", carrier: "DHL Express" });

    const result = await createLabelForOrder({ sessionId: "cs_label_1" });
    expect(result).toEqual({ ok: false, reason: "unsupported" });
    expect(createPaketLabelMock).not.toHaveBeenCalled();
  });

  it("rejects orders without a shipping address", async () => {
    seedPaidOrder({ shippingAddress: null });
    expect(await createLabelForOrder({ sessionId: "cs_label_1" })).toEqual({
      ok: false,
      reason: "no-address",
    });
  });

  it("maps DHL validation failures", async () => {
    seedPaidOrder();
    createPaketLabelMock.mockResolvedValue({
      ok: false,
      reason: "validation",
      detail: "street not found",
    });

    expect(await createLabelForOrder({ sessionId: "cs_label_1" })).toEqual({
      ok: false,
      reason: "validation",
      detail: "street not found",
    });
  });
});
