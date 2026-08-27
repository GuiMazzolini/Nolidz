import { afterEach, describe, expect, it, vi } from "vitest";

import { isGoogleConfigured } from "@/app/lib/oauth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isGoogleConfigured", () => {
  it("is configured when both halves of the credential pair are set", () => {
    vi.stubEnv("GOOGLE_ID", "client-id");
    vi.stubEnv("GOOGLE_SECRET", "client-secret");
    expect(isGoogleConfigured()).toBe(true);
  });

  it.each([
    ["neither", "", ""],
    ["only the id", "client-id", ""],
    ["only the secret", "", "client-secret"],
  ])("is unconfigured with %s set", (_label, id, secret) => {
    vi.stubEnv("GOOGLE_ID", id);
    vi.stubEnv("GOOGLE_SECRET", secret);
    expect(isGoogleConfigured()).toBe(false);
  });

  // A half-filled `.env.local` copied from `.env.example` leaves whitespace
  // behind more often than it leaves the key out entirely.
  it("treats whitespace-only credentials as absent", () => {
    vi.stubEnv("GOOGLE_ID", "  ");
    vi.stubEnv("GOOGLE_SECRET", "client-secret");
    expect(isGoogleConfigured()).toBe(false);
  });
});
