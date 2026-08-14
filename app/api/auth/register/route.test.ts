import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

import { POST } from "@/app/api/auth/register/route";
import { jsonRequest, malformedRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import type { UserDoc } from "@/app/lib/db-collections";

const credentials = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "correct horse battery",
};

function users(): UserDoc[] {
  return testDb.all("users") as unknown as UserDoc[];
}

beforeEach(() => {
  testDb.reset();
});

describe("POST /api/auth/register", () => {
  it("creates an account and stores only a hash of the password", async () => {
    const { status, body } = await readResponse<{ ok: boolean }>(
      await POST(jsonRequest("POST", credentials))
    );

    expect(status).toBe(201);
    expect(body).toEqual({ ok: true });

    const [user] = users();
    expect(user.name).toBe("Ada Lovelace");
    expect(user.email).toBe("ada@example.com");
    expect(user.passwordHash).not.toBe(credentials.password);
    expect(JSON.stringify(user)).not.toContain(credentials.password);
    await expect(
      bcrypt.compare(credentials.password, user.passwordHash!)
    ).resolves.toBe(true);
  });

  it("normalizes the email so casing cannot fork an account", async () => {
    await POST(
      jsonRequest("POST", { ...credentials, email: "  ADA@Example.COM " })
    );
    expect(users()[0].email).toBe("ada@example.com");

    const duplicate = await POST(jsonRequest("POST", credentials));
    expect(duplicate.status).toBe(409);
    expect(users()).toHaveLength(1);
  });

  it("409s an email that already exists", async () => {
    await POST(jsonRequest("POST", credentials));

    const { status, body } = await readResponse<{ error: string }>(
      await POST(jsonRequest("POST", credentials))
    );

    expect(status).toBe(409);
    expect(body.error).toContain("already exists");
  });

  it("409s when the unique index catches a racing signup", async () => {
    // Two concurrent requests both pass the existence check; the index is what
    // actually enforces uniqueness.
    const [first, second] = await Promise.all([
      POST(jsonRequest("POST", credentials)),
      POST(jsonRequest("POST", credentials)),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(users()).toHaveLength(1);
  });

  it("rejects a weak or malformed payload", async () => {
    const bad = [
      { ...credentials, password: "short" },
      { ...credentials, email: "not-an-email" },
      { ...credentials, name: "" },
      { name: "Ada" },
    ];

    for (const body of bad) {
      expect((await POST(jsonRequest("POST", body))).status).toBe(400);
    }
    expect(users()).toHaveLength(0);
  });

  it("rejects a Mongo operator in place of the email", async () => {
    const res = await POST(
      jsonRequest("POST", { ...credentials, email: { $ne: null } })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed body", async () => {
    expect((await POST(malformedRequest())).status).toBe(400);
  });

  it("is rate limited per IP", async () => {
    // The register budget is 5 per hour.
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        jsonRequest("POST", { ...credentials, email: `user${i}@example.com` })
      );
      expect(res.status).toBe(201);
    }

    const limited = await POST(
      jsonRequest("POST", { ...credentials, email: "sixth@example.com" })
    );
    expect(limited.status).toBe(429);
    expect(users()).toHaveLength(5);
  });

  it("keeps separate budgets for separate IPs", async () => {
    for (let i = 0; i < 5; i++) {
      await POST(
        jsonRequest("POST", { ...credentials, email: `user${i}@example.com` })
      );
    }

    const other = await POST(
      jsonRequest(
        "POST",
        { ...credentials, email: "elsewhere@example.com" },
        { ip: "198.51.100.7" }
      )
    );
    expect(other.status).toBe(201);
  });
});
