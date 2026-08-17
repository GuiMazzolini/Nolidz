import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DhlNotConfiguredError,
  fetchTrackingStatus,
  isDhlConfigured,
  parseTrackingResponse,
} from "./dhl";

const SAMPLE = {
  shipments: [
    {
      id: "00340434161094042557",
      status: {
        timestamp: "2026-08-17T09:12:00+02:00",
        statusCode: "transit",
        description: "The shipment is being transported",
        location: { address: { addressLocality: "Hamburg" } },
      },
    },
  ],
};

describe("parseTrackingResponse", () => {
  it("pulls status, description, timestamp and location", () => {
    const status = parseTrackingResponse(SAMPLE);
    expect(status).toEqual({
      statusCode: "transit",
      description: "The shipment is being transported",
      timestamp: new Date("2026-08-17T09:12:00+02:00"),
      location: "Hamburg",
    });
  });

  // A third-party payload we do not version: every malformed shape must
  // degrade, never throw inside a render.
  it("returns null for a body with no shipments", () => {
    expect(parseTrackingResponse({ shipments: [] })).toBeNull();
    expect(parseTrackingResponse({})).toBeNull();
    expect(parseTrackingResponse(null)).toBeNull();
    expect(parseTrackingResponse("nope")).toBeNull();
  });

  it("falls back to unknown for an unrecognised status code", () => {
    const status = parseTrackingResponse({
      shipments: [{ status: { statusCode: "teleported" } }],
    });
    expect(status?.statusCode).toBe("unknown");
  });

  it("survives a shipment with no status object at all", () => {
    const status = parseTrackingResponse({ shipments: [{}] });
    expect(status).toEqual({
      statusCode: "unknown",
      description: null,
      timestamp: null,
      location: null,
    });
  });

  // An Invalid Date would reach Mongo and then blow up on format.
  it("drops an unparseable timestamp rather than storing Invalid Date", () => {
    const status = parseTrackingResponse({
      shipments: [{ status: { statusCode: "transit", timestamp: "not a date" } }],
    });
    expect(status?.timestamp).toBeNull();
  });

  it("normalizes case on the status code", () => {
    const status = parseTrackingResponse({
      shipments: [{ status: { statusCode: "DELIVERED" } }],
    });
    expect(status?.statusCode).toBe("delivered");
  });
});

describe("fetchTrackingStatus", () => {
  const originalKey = process.env.DHL_API_KEY;

  beforeEach(() => {
    process.env.DHL_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.DHL_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("sends the key as a header and scopes to parcel-de", async () => {
    const fetchMock = stubFetch(200, SAMPLE);
    await fetchTrackingStatus("00340434161094042557");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toContain("trackingNumber=00340434161094042557");
    // Without this, DHL searches every division and can return a
    // same-numbered shipment from another one.
    expect(url.toString()).toContain("service=parcel-de");
    expect((init.headers as Record<string, string>)["DHL-API-Key"]).toBe("test-key");
  });

  it("returns the parsed status on 200", async () => {
    stubFetch(200, SAMPLE);
    const result = await fetchTrackingStatus("00340434161094042557");
    expect(result).toEqual({
      ok: true,
      status: {
        statusCode: "transit",
        description: "The shipment is being transported",
        timestamp: new Date("2026-08-17T09:12:00+02:00"),
        location: "Hamburg",
      },
    });
  });

  // 404 is the normal state for the first hours after a label is created, so
  // it must not read as a fault.
  it("maps 404 to not-found", async () => {
    stubFetch(404, { title: "Not Found" });
    expect(await fetchTrackingStatus("x")).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("maps a 200 carrying no shipment to not-found too", async () => {
    stubFetch(200, { shipments: [] });
    expect(await fetchTrackingStatus("x")).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  // Distinct from a generic error: this means stop for the day.
  it("maps 429 to rate-limited", async () => {
    stubFetch(429, {});
    expect(await fetchTrackingStatus("x")).toEqual({
      ok: false,
      reason: "rate-limited",
    });
  });

  it("maps 401 and 403 to unauthorized", async () => {
    stubFetch(401, {});
    expect(await fetchTrackingStatus("x")).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    stubFetch(403, {});
    expect(await fetchTrackingStatus("x")).toEqual({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("reports a network failure without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("socket hang up");
      })
    );
    const result = await fetchTrackingStatus("x");
    expect(result).toEqual({
      ok: false,
      reason: "error",
      detail: "socket hang up",
    });
  });

  it("reports invalid JSON without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502</html>", { status: 200 }))
    );
    const result = await fetchTrackingStatus("x");
    expect(result).toMatchObject({ ok: false, reason: "error" });
  });

  it("throws when the key is missing, rather than calling DHL anonymously", async () => {
    delete process.env.DHL_API_KEY;
    await expect(fetchTrackingStatus("x")).rejects.toBeInstanceOf(
      DhlNotConfiguredError
    );
  });
});

describe("isDhlConfigured", () => {
  const originalKey = process.env.DHL_API_KEY;
  afterEach(() => {
    process.env.DHL_API_KEY = originalKey;
  });

  it("tracks whether the key is set", () => {
    process.env.DHL_API_KEY = "k";
    expect(isDhlConfigured()).toBe(true);
    delete process.env.DHL_API_KEY;
    expect(isDhlConfigured()).toBe(false);
  });
});
