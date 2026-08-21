import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DpdNotConfiguredError,
  fetchDpdTrackingStatus,
  isDpdConfigured,
  mapDpdStatus,
  parseDpdResponse,
  resetDpdAuthCache,
} from "./dpd";

const SAMPLE = {
  parcelLifeCycleData: {
    statusInfo: [
      {
        status: "ACCEPTED",
        statusHasBeenReached: true,
        date: "2026-08-17T09:12:00+02:00",
        label: { content: "Parcel handed over to DPD" },
        location: "Aschaffenburg",
      },
      {
        status: "IN_TRANSIT",
        statusHasBeenReached: true,
        date: "2026-08-18T06:40:00+02:00",
        label: { content: "In transit" },
        location: "Hamburg",
      },
      {
        status: "DELIVERED",
        statusHasBeenReached: false,
        label: { content: "Delivered" },
      },
    ],
  },
};

describe("mapDpdStatus", () => {
  it("folds DPD's scan codes into our five buckets", () => {
    expect(mapDpdStatus("DELIVERED")).toBe("delivered");
    expect(mapDpdStatus("IN_TRANSIT")).toBe("transit");
    expect(mapDpdStatus("OUT_FOR_DELIVERY")).toBe("transit");
    expect(mapDpdStatus("LABEL_CREATED")).toBe("pre-transit");
    expect(mapDpdStatus("NOT_DELIVERED")).toBe("failure");
  });

  it("normalizes case and whitespace", () => {
    expect(mapDpdStatus(" delivered ")).toBe("delivered");
  });

  // A shape change must degrade, never throw inside a page render.
  it("falls back to unknown for anything unrecognised", () => {
    expect(mapDpdStatus("SOMETHING_NEW")).toBe("unknown");
    expect(mapDpdStatus(null)).toBe("unknown");
    expect(mapDpdStatus(42)).toBe("unknown");
  });
});

describe("parseDpdResponse", () => {
  /**
   * DPD sends the whole scan history with the reached ones flagged. Taking the
   * last entry outright would report a parcel delivered while it is still in
   * transit, because the unreached tail is DPD's forecast.
   */
  it("reads the last reached scan, not the last forecast one", () => {
    const status = parseDpdResponse(SAMPLE);
    expect(status?.statusCode).toBe("transit");
    expect(status?.description).toBe("In transit");
    expect(status?.location).toBe("Hamburg");
    expect(status?.timestamp?.toISOString()).toBe("2026-08-18T04:40:00.000Z");
  });

  it("returns null when no scan has been reached yet", () => {
    const status = parseDpdResponse({
      parcelLifeCycleData: {
        statusInfo: [{ status: "LABEL_CREATED", statusHasBeenReached: false }],
      },
    });
    expect(status).toBeNull();
  });

  it("returns null on a payload with no lifecycle data at all", () => {
    expect(parseDpdResponse(null)).toBeNull();
    expect(parseDpdResponse({})).toBeNull();
    expect(parseDpdResponse({ parcelLifeCycleData: { statusInfo: [] } })).toBeNull();
  });

  // An Invalid Date would reach Mongo and then blow up on format.
  it("drops an unparseable timestamp rather than storing Invalid Date", () => {
    const status = parseDpdResponse({
      parcelLifeCycleData: {
        statusInfo: [
          { status: "IN_TRANSIT", statusHasBeenReached: true, date: "not a date" },
        ],
      },
    });
    expect(status?.timestamp).toBeNull();
  });
});

describe("fetchDpdTrackingStatus", () => {
  const original = {
    url: process.env.DPD_API_URL,
    delisId: process.env.DPD_DELIS_ID,
    password: process.env.DPD_PASSWORD,
  };

  beforeEach(() => {
    process.env.DPD_API_URL = "https://dpd.test";
    process.env.DPD_DELIS_ID = "delis-1";
    process.env.DPD_PASSWORD = "secret";
    resetDpdAuthCache();
  });

  afterEach(() => {
    for (const [key, value] of [
      ["DPD_API_URL", original.url],
      ["DPD_DELIS_ID", original.delisId],
      ["DPD_PASSWORD", original.password],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
  });

  /**
   * Every call is login-then-lookup, so the stub answers by URL rather than by
   * call order — a test that hard-codes the order breaks the moment the token
   * cache saves a login.
   */
  function stubFetch(
    lookup: { status: number; body: unknown },
    login: { status: number; body: unknown } = {
      status: 200,
      body: { authToken: "tok", expires: 600 },
    }
  ) {
    const fetchMock = vi.fn(async (input: URL | string) => {
      const url = input.toString();
      const match = url.includes("/api/login") ? login : lookup;
      return new Response(JSON.stringify(match.body), {
        status: match.status,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("authenticates, then asks for the parcel with the token", async () => {
    const fetchMock = stubFetch({ status: 200, body: SAMPLE });
    const result = await fetchDpdTrackingStatus("09876543210987");

    expect(result).toEqual({
      ok: true,
      status: expect.objectContaining({ statusCode: "transit" }),
    });

    const [loginUrl] = fetchMock.mock.calls[0] as unknown as [string];
    expect(loginUrl).toBe("https://dpd.test/api/login");

    const [lookupUrl, init] = fetchMock.mock.calls[1] as unknown as [URL, RequestInit];
    expect(lookupUrl.toString()).toContain("parcelNo=09876543210987");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  /**
   * DPD rate-limits logins far harder than lookups, so a second parcel must
   * reuse the token rather than authenticate again.
   */
  it("reuses a cached token across lookups", async () => {
    const fetchMock = stubFetch({ status: 200, body: SAMPLE });
    await fetchDpdTrackingStatus("1");
    await fetchDpdTrackingStatus("2");

    const logins = fetchMock.mock.calls.filter(([input]) =>
      input!.toString().includes("/api/login")
    );
    expect(logins).toHaveLength(1);
  });

  // A token DPD has stopped accepting must not poison every later lookup.
  it("drops the cached token when DPD rejects it", async () => {
    const fetchMock = stubFetch({ status: 401, body: {} });
    const result = await fetchDpdTrackingStatus("1");
    expect(result).toEqual({ ok: false, reason: "unauthorized" });

    await fetchDpdTrackingStatus("2");
    const logins = fetchMock.mock.calls.filter(([input]) =>
      input!.toString().includes("/api/login")
    );
    expect(logins).toHaveLength(2);
  });

  it("reports a failed login as unauthorized without attempting a lookup", async () => {
    const fetchMock = stubFetch(
      { status: 200, body: SAMPLE },
      { status: 401, body: {} }
    );
    expect(await fetchDpdTrackingStatus("1")).toEqual({
      ok: false,
      reason: "unauthorized",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps DPD's error codes onto the shared result union", async () => {
    stubFetch({ status: 404, body: {} });
    expect(await fetchDpdTrackingStatus("1")).toEqual({
      ok: false,
      reason: "not-found",
    });

    resetDpdAuthCache();
    stubFetch({ status: 429, body: {} });
    expect(await fetchDpdTrackingStatus("1")).toEqual({
      ok: false,
      reason: "rate-limited",
    });

    resetDpdAuthCache();
    stubFetch({ status: 500, body: {} });
    expect(await fetchDpdTrackingStatus("1")).toEqual({
      ok: false,
      reason: "error",
      detail: "HTTP 500",
    });
  });

  /**
   * A 200 with nothing scanned is the normal state for the hours after a label
   * is printed, and reads the same to a caller as a 404.
   */
  it("treats a 200 with no reached scan as not-found", async () => {
    stubFetch({ status: 200, body: { parcelLifeCycleData: { statusInfo: [] } } });
    expect(await fetchDpdTrackingStatus("1")).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("throws rather than guessing when credentials are absent", async () => {
    delete process.env.DPD_PASSWORD;
    expect(isDpdConfigured()).toBe(false);
    await expect(fetchDpdTrackingStatus("1")).rejects.toBeInstanceOf(
      DpdNotConfiguredError
    );
  });

  it("needs all three settings before it considers itself configured", () => {
    expect(isDpdConfigured()).toBe(true);
    delete process.env.DPD_API_URL;
    expect(isDpdConfigured()).toBe(false);
  });
});
