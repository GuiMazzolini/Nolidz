import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildConsigneeAddress,
  buildCreateOrdersBody,
  getDefaultLabelWeightKg,
  isDhlShippingConfigured,
  parseCreateOrdersResponse,
  readDhlShippingConfig,
  resetDhlShippingAuthCache,
  toDhlCountryCode,
  createPaketLabel,
} from "@/app/lib/dhl-shipping";

const SHIPPING_ENV = {
  DHL_SHIPPING_CLIENT_ID: "client",
  DHL_SHIPPING_CLIENT_SECRET: "secret",
  DHL_GKP_USERNAME: "user",
  DHL_GKP_PASSWORD: "pass",
  DHL_BILLING_NUMBER: "33333333330102",
  DHL_SHIPPING_SANDBOX: "true",
  DHL_DEFAULT_WEIGHT_KG: "1",
};

function stubShippingEnv() {
  for (const [key, value] of Object.entries(SHIPPING_ENV)) {
    vi.stubEnv(key, value);
  }
}

beforeEach(() => {
  resetDhlShippingAuthCache();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetDhlShippingAuthCache();
});

describe("isDhlShippingConfigured / readDhlShippingConfig", () => {
  it("is false when any credential is missing", () => {
    expect(isDhlShippingConfigured()).toBe(false);
    vi.stubEnv("DHL_SHIPPING_CLIENT_ID", "x");
    expect(isDhlShippingConfigured()).toBe(false);
  });

  it("reads all fields when complete", () => {
    stubShippingEnv();
    expect(isDhlShippingConfigured()).toBe(true);
    expect(readDhlShippingConfig()).toMatchObject({
      clientId: "client",
      billingNumber: "33333333330102",
      sandbox: true,
      defaultWeightKg: 1,
    });
  });

  it("treats sandbox as on unless explicitly false", () => {
    stubShippingEnv();
    vi.stubEnv("DHL_SHIPPING_SANDBOX", "false");
    expect(readDhlShippingConfig()?.sandbox).toBe(false);
  });

  it("getDefaultLabelWeightKg falls back to 1 when unset", () => {
    expect(getDefaultLabelWeightKg()).toBe(1);
    stubShippingEnv();
    vi.stubEnv("DHL_DEFAULT_WEIGHT_KG", "1.5");
    expect(getDefaultLabelWeightKg()).toBe(1.5);
  });
});

describe("toDhlCountryCode", () => {
  it("maps German variants to DEU", () => {
    expect(toDhlCountryCode("DE")).toBe("DEU");
    expect(toDhlCountryCode("deutschland")).toBe("DEU");
    expect(toDhlCountryCode(null)).toBe("DEU");
  });
});

describe("buildCreateOrdersBody", () => {
  it("builds a V01PAK shipment with weight in grams", () => {
    stubShippingEnv();
    const config = readDhlShippingConfig()!;
    const body = buildCreateOrdersBody(config, {
      refNo: "cs_test_123456",
      consignee: {
        name: "Maria",
        line1: "Kurt-Schumacher-Str. 20",
        line2: null,
        city: "Bonn",
        state: null,
        postalCode: "53113",
        country: "DE",
      },
      weightKg: 0.5,
    });

    expect(body).toMatchObject({
      profile: "STANDARD_GRUPPENPROFIL",
      shipments: [
        {
          product: "V01PAK",
          billingNumber: "33333333330102",
          consignee: {
            name1: "Maria",
            addressStreet: "Kurt-Schumacher-Str. 20",
            postalCode: "53113",
            city: "Bonn",
            country: "DEU",
          },
          details: { weight: { uom: "g", value: 500 } },
        },
      ],
    });
    expect(buildConsigneeAddress({
      name: "A",
      line1: "Street 1",
      line2: "Apt 2",
      city: "Berlin",
      state: null,
      postalCode: "10967",
      country: "DE",
    }).addressStreet).toBe("Street 1, Apt 2");
  });
});

describe("parseCreateOrdersResponse", () => {
  it("reads shipmentNo and base64 PDF", () => {
    const pdf = Buffer.from("%PDF-test").toString("base64");
    const parsed = parseCreateOrdersResponse({
      items: [
        {
          shipmentNo: "JJD000390005123456789",
          sstatus: { status: 200, title: "OK" },
          label: { b64: pdf, fileFormat: "PDF" },
        },
      ],
    });
    expect(parsed?.trackingNumber).toBe("JJD000390005123456789");
    expect(parsed?.pdfBuffer?.toString()).toBe("%PDF-test");
  });

  it("accepts a label URL when b64 is missing", () => {
    const parsed = parseCreateOrdersResponse({
      items: [
        {
          shipmentNo: "SN1",
          sstatus: { status: 200 },
          label: { url: "https://example.com/label.pdf" },
        },
      ],
    });
    expect(parsed).toEqual({
      trackingNumber: "SN1",
      shipmentNo: "SN1",
      pdfBuffer: null,
      labelUrl: "https://example.com/label.pdf",
    });
  });

  it("returns null when the item status is an error", () => {
    expect(
      parseCreateOrdersResponse({
        items: [
          {
            shipmentNo: "SN1",
            sstatus: { status: 400, title: "Bad" },
            label: { b64: "x" },
          },
        ],
      })
    ).toBeNull();
  });
});

describe("createPaketLabel", () => {
  it("throws when unconfigured", async () => {
    await expect(
      createPaketLabel({
        refNo: "ref12345",
        consignee: {
          name: "A",
          line1: "St 1",
          line2: null,
          city: "Berlin",
          state: null,
          postalCode: "10967",
          country: "DE",
        },
      })
    ).rejects.toThrow(/not configured/);
  });

  it("returns unauthorized when sandbox Basic Auth is rejected", async () => {
    stubShippingEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      })
    );

    const result = await createPaketLabel({
      refNo: "ref12345",
      consignee: {
        name: "A",
        line1: "St 1",
        line2: null,
        city: "Berlin",
        state: null,
        postalCode: "10967",
        country: "DE",
      },
    });
    expect(result).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("creates a sandbox label with Basic Auth (no OAuth token call)", async () => {
    stubShippingEnv();
    const pdf = Buffer.from("%PDF").toString("base64");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            shipmentNo: "TRACK99",
            sstatus: { status: 200 },
            label: { b64: pdf },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaketLabel({
      refNo: "ref12345",
      consignee: {
        name: "A",
        line1: "St 1",
        line2: null,
        city: "Berlin",
        state: null,
        postalCode: "10967",
        country: "DE",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.label.trackingNumber).toBe("TRACK99");
      expect(result.label.pdfBuffer?.toString()).toBe("%PDF");
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const ordersCall = fetchMock.mock.calls[0];
    expect(String(ordersCall[0])).toContain(
      "api-sandbox.dhl.com/parcel/de/shipping/v2/orders"
    );
    expect(ordersCall[1].headers.Authorization).toMatch(/^Basic /);
    expect(ordersCall[1].headers["dhl-api-key"]).toBe("client");
  });

  it("uses OAuth Bearer in production", async () => {
    stubShippingEnv();
    vi.stubEnv("DHL_SHIPPING_SANDBOX", "false");
    const pdf = Buffer.from("%PDF").toString("base64");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", expires_in: 1800 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              shipmentNo: "TRACK99",
              sstatus: { status: 200 },
              label: { b64: pdf },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaketLabel({
      refNo: "ref12345",
      consignee: {
        name: "A",
        line1: "St 1",
        line2: null,
        city: "Berlin",
        state: null,
        postalCode: "10967",
        country: "DE",
      },
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer tok");
  });
});
