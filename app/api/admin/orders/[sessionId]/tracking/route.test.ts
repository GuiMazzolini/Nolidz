import { beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

// Only the lookup is faked. `describeTrackingStatus` stays real so the
// fallback wording below is the wording a customer would actually read.
vi.mock("@/app/lib/tracking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/tracking")>()),
  refreshTrackingForOrder: refreshMock,
}));

import { POST } from "@/app/api/admin/orders/[sessionId]/tracking/route";
import type { CachedTracking, RefreshOutcome } from "@/app/lib/tracking";
import { ADMIN, BUYER } from "@/app/test/fixtures";
import { jsonRequest, malformedRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import { setEmaillessSession, setMockSession } from "@/app/test/session";

function params(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

const inTransit: CachedTracking = {
  statusCode: "transit",
  description: "Sendung wird zugestellt",
  location: "Berlin",
  eventAt: new Date("2026-06-02T09:00:00Z"),
  checkedAt: new Date("2026-06-02T10:00:00Z"),
};

function resolvesTo(outcome: RefreshOutcome) {
  refreshMock.mockResolvedValue(outcome);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  testDb.reset();
  setMockSession(ADMIN);
  resolvesTo({ ok: true, tracking: inTransit, refreshed: true });
});

describe("tracking refresh authorization", () => {
  /**
   * This is the only route that can spend the daily DHL budget, so the 401 is
   * the thing protecting it — not the parcel status, which the customer can
   * already see on their own order page.
   */
  it("locks out a signed-in shopper who is not an admin", async () => {
    setMockSession(BUYER);

    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"), params("cs_1"))
    );

    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("locks out a signed-out visitor", async () => {
    setMockSession(null);

    expect((await POST(jsonRequest("POST"), params("cs_1"))).status).toBe(401);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("treats a session with no email as unauthenticated", async () => {
    setEmaillessSession();

    expect((await POST(jsonRequest("POST"), params("cs_1"))).status).toBe(401);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("rejects an address that is not on the admin list even when one is set", async () => {
    vi.stubEnv("ADMIN_EMAILS", "someone-else@example.com");

    expect((await POST(jsonRequest("POST"), params("cs_1"))).status).toBe(401);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/orders/[sessionId]/tracking", () => {
  it("returns the refreshed status with DHL's own description", async () => {
    const { status, body } = await readResponse<{
      refreshed: boolean;
      statusCode: string;
      description: string;
      location: string;
    }>(await POST(jsonRequest("POST"), params("cs_1")));

    expect(status).toBe(200);
    expect(body).toMatchObject({
      refreshed: true,
      statusCode: "transit",
      description: "Sendung wird zugestellt",
      location: "Berlin",
    });
  });

  it("falls back to our own wording when DHL sends no description", async () => {
    resolvesTo({
      ok: true,
      tracking: { ...inTransit, description: null },
      refreshed: true,
    });

    const { body } = await readResponse<{ description: string }>(
      await POST(jsonRequest("POST"), params("cs_1"))
    );

    expect(body.description).toBe("On its way");
  });

  it("reports a cached answer as not refreshed rather than as an error", async () => {
    // The six-hour floor blocked the call; a stale status is still the right
    // thing to show, so this is a 200.
    resolvesTo({ ok: true, tracking: inTransit, refreshed: false });

    const { status, body } = await readResponse<{ refreshed: boolean }>(
      await POST(jsonRequest("POST"), params("cs_1"))
    );

    expect(status).toBe(200);
    expect(body.refreshed).toBe(false);
  });

  it("passes the order id through to the lookup", async () => {
    await POST(jsonRequest("POST"), params("cs_live_42"));

    expect(refreshMock).toHaveBeenCalledWith(expect.anything(), "cs_live_42", {
      force: false,
    });
  });

  it("400s a blank order id without spending a DHL request", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"), params(""))
    );

    expect(status).toBe(400);
    expect(body.error).toBe("Missing order id");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("the force flag", () => {
  it("forwards force: true for an admin with a customer on the phone", async () => {
    await POST(jsonRequest("POST", { force: true }), params("cs_1"));

    expect(refreshMock).toHaveBeenCalledWith(expect.anything(), "cs_1", {
      force: true,
    });
  });

  it("defaults to false when the request has no body", async () => {
    await POST(jsonRequest("POST"), params("cs_1"));

    expect(refreshMock).toHaveBeenCalledWith(expect.anything(), "cs_1", {
      force: false,
    });
  });

  it("defaults to false rather than throwing on an unparseable body", async () => {
    const res = await POST(malformedRequest(), params("cs_1"));

    expect(res.status).toBe(200);
    expect(refreshMock).toHaveBeenCalledWith(expect.anything(), "cs_1", {
      force: false,
    });
  });

  it("only honours a literal true, so a truthy value does not skip the floor", async () => {
    await POST(jsonRequest("POST", { force: "yes" }), params("cs_1"));

    expect(refreshMock).toHaveBeenCalledWith(expect.anything(), "cs_1", {
      force: false,
    });
  });
});

describe("failure reasons map to the status the admin needs to see", () => {
  const cases: [RefreshOutcome & { ok: false }, number, string][] = [
    [{ ok: false, reason: "no-tracking-number" }, 400, "no tracking number"],
    [{ ok: false, reason: "carrier-not-supported" }, 400, "only check DHL"],
    [{ ok: false, reason: "not-configured" }, 503, "DHL_API_KEY"],
    [{ ok: false, reason: "throttled" }, 429, "checked recently"],
    [{ ok: false, reason: "not-found" }, 404, "not registered"],
    [{ ok: false, reason: "rate-limited" }, 429, "daily request limit"],
    [{ ok: false, reason: "unauthorized" }, 502, "rejected our API key"],
    [{ ok: false, reason: "error" }, 502, "Could not reach DHL"],
  ];

  it.each(cases)("%o becomes %i", async (outcome, expected, fragment) => {
    resolvesTo(outcome);

    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"), params("cs_1"))
    );

    expect(status).toBe(expected);
    expect(body.error).toContain(fragment);
  });

  it("treats an unrecognised reason as an upstream failure, not a success", async () => {
    resolvesTo({ ok: false, reason: "something-new" } as never);

    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST"), params("cs_1"))
    );

    expect(status).toBe(502);
    expect(body.error).toContain("Could not reach DHL");
  });
});
