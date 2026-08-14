import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

import { POST } from "@/app/api/admin/uploads/sign/route";
import { ADMIN, BUYER } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import { setMockSession } from "@/app/test/session";

type SignResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: string;
  folder: string;
  signature: string;
  error?: string;
};

beforeEach(() => {
  testDb.reset();
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
  vi.stubEnv("CLOUDINARY_API_KEY", "key123");
  vi.stubEnv("CLOUDINARY_API_SECRET", "secret123");
  setMockSession(ADMIN);
});

describe("POST /api/admin/uploads/sign", () => {
  it("returns a signature for an admin", async () => {
    const { status, body } = await readResponse<SignResponse>(
      await POST(jsonRequest("POST"))
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({ cloudName: "demo", apiKey: "key123" });
    expect(body.signature).toMatch(/^[a-f0-9]+$/);
    // The secret signs the request; it must never travel to the browser.
    expect(JSON.stringify(body)).not.toContain("secret123");
  });

  it("refuses a signed-in non-admin and a signed-out visitor", async () => {
    setMockSession(BUYER);
    expect((await POST(jsonRequest("POST"))).status).toBe(401);

    setMockSession(null);
    expect((await POST(jsonRequest("POST"))).status).toBe(401);
  });

  it("reports a configuration problem instead of a broken signature", async () => {
    vi.stubEnv("CLOUDINARY_API_SECRET", "");

    const { status, body } = await readResponse<SignResponse>(
      await POST(jsonRequest("POST"))
    );

    expect(status).toBe(500);
    expect(body.error).toBe("Cloudinary is not configured");
  });

  it("is rate limited", async () => {
    for (let i = 0; i < 60; i++) {
      expect((await POST(jsonRequest("POST"))).status).toBe(200);
    }
    expect((await POST(jsonRequest("POST"))).status).toBe(429);
  });
});
