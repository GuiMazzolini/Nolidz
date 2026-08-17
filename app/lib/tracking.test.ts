import { describe, expect, it } from "vitest";
import {
  TRACKING_REFRESH_FLOOR_MS,
  canRefreshTracking,
  describeTrackingStatus,
  isTerminalStatus,
  readCachedTracking,
  type CachedTracking,
} from "./tracking";

function cached(overrides: Partial<CachedTracking> = {}): CachedTracking {
  return {
    statusCode: "transit",
    description: "On the way",
    location: "Hamburg",
    eventAt: new Date("2026-08-17T08:00:00Z"),
    checkedAt: new Date("2026-08-17T08:00:00Z"),
    ...overrides,
  };
}

describe("canRefreshTracking", () => {
  const now = new Date("2026-08-17T12:00:00Z");

  it("allows the first ever lookup", () => {
    expect(canRefreshTracking(null, now)).toBe(true);
  });

  // The rule that protects the 250/day budget.
  it("blocks a second lookup inside the floor", () => {
    const justChecked = cached({
      checkedAt: new Date(now.getTime() - TRACKING_REFRESH_FLOOR_MS + 1000),
    });
    expect(canRefreshTracking(justChecked, now)).toBe(false);
  });

  it("allows one once the floor has passed", () => {
    const stale = cached({
      checkedAt: new Date(now.getTime() - TRACKING_REFRESH_FLOOR_MS),
    });
    expect(canRefreshTracking(stale, now)).toBe(true);
  });

  // A delivered parcel has nothing further to report, so every later lookup
  // would be spent budget.
  it("never refreshes a terminal status, however old", () => {
    const ancient = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(canRefreshTracking(cached({ statusCode: "delivered", checkedAt: ancient }), now)).toBe(false);
    expect(canRefreshTracking(cached({ statusCode: "failure", checkedAt: ancient }), now)).toBe(false);
  });

  it("keeps refreshing a non-terminal status", () => {
    const old = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(canRefreshTracking(cached({ statusCode: "pre-transit", checkedAt: old }), now)).toBe(true);
    expect(canRefreshTracking(cached({ statusCode: "unknown", checkedAt: old }), now)).toBe(true);
  });
});

describe("isTerminalStatus", () => {
  it("counts delivered and failure, nothing else", () => {
    expect(isTerminalStatus("delivered")).toBe(true);
    expect(isTerminalStatus("failure")).toBe(true);
    expect(isTerminalStatus("transit")).toBe(false);
    expect(isTerminalStatus("pre-transit")).toBe(false);
    expect(isTerminalStatus("unknown")).toBe(false);
    expect(isTerminalStatus(null)).toBe(false);
  });
});

describe("readCachedTracking", () => {
  it("reads a stored entry back", () => {
    const entry = readCachedTracking({
      tracking: {
        statusCode: "delivered",
        description: "Delivered to the recipient",
        location: "Berlin",
        eventAt: "2026-08-17T08:00:00Z",
        checkedAt: "2026-08-17T09:00:00Z",
      },
    });
    expect(entry).toEqual({
      statusCode: "delivered",
      description: "Delivered to the recipient",
      location: "Berlin",
      eventAt: new Date("2026-08-17T08:00:00Z"),
      checkedAt: new Date("2026-08-17T09:00:00Z"),
    });
  });

  it("returns null for an order that has never been checked", () => {
    expect(readCachedTracking({})).toBeNull();
    expect(readCachedTracking(null)).toBeNull();
    expect(readCachedTracking(undefined)).toBeNull();
  });

  // Without checkedAt the floor cannot be applied, so the entry is worthless
  // as a cache and must not be trusted as one.
  it("rejects an entry with no checkedAt", () => {
    expect(
      readCachedTracking({ tracking: { statusCode: "transit" } })
    ).toBeNull();
  });

  it("drops an unparseable event date", () => {
    const entry = readCachedTracking({
      tracking: { statusCode: "transit", eventAt: "nope", checkedAt: "2026-08-17T09:00:00Z" },
    });
    expect(entry?.eventAt).toBeNull();
  });
});

describe("describeTrackingStatus", () => {
  it("gives a customer-readable line for every code", () => {
    expect(describeTrackingStatus("pre-transit")).toMatch(/not scanned/i);
    expect(describeTrackingStatus("transit")).toBe("On its way");
    expect(describeTrackingStatus("delivered")).toBe("Delivered");
    expect(describeTrackingStatus("failure")).toMatch(/problem/i);
    expect(describeTrackingStatus("unknown")).toMatch(/unavailable/i);
  });
});
