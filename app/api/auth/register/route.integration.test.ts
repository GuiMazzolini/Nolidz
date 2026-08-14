import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/auth/register/route";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { jsonRequest } from "@/app/test/http";
import {
  isMongoAvailable,
  useTestDatabase,
  type TestDatabase,
} from "@/app/test/mongo-integration";

const available = await isMongoAvailable();
let test: TestDatabase;

const credentials = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "correct horse battery",
};

/**
 * Registration does check-then-insert, which races. The unique index on
 * users.email is the thing that actually enforces one account per address, and
 * only a real server can prove it fires.
 */
describe.skipIf(!available)("registration against a real MongoDB", () => {
  beforeAll(async () => {
    test = await useTestDatabase("register");
  });

  afterEach(async () => {
    await test.clear();
  });

  afterAll(async () => {
    await test?.drop();
  });

  it("creates the unique index the race relies on", async () => {
    // Touch the app's connection so ensureIndexes runs.
    await POST(jsonRequest("POST", credentials));

    const indexes = await test.db.collection("users").indexes();
    const emailIndex = indexes.find((i) => i.key?.email === 1);

    expect(emailIndex?.unique).toBe(true);
  });

  it("lets exactly one of two concurrent signups win", async () => {
    const [first, second] = await Promise.all([
      POST(jsonRequest("POST", credentials)),
      POST(jsonRequest("POST", credentials)),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await test.db.collection("users").countDocuments({})).toBe(1);
  });

  it("rejects a duplicate that differs only in casing", async () => {
    await POST(jsonRequest("POST", credentials));
    const duplicate = await POST(
      jsonRequest("POST", { ...credentials, email: "ADA@EXAMPLE.COM" })
    );

    expect(duplicate.status).toBe(409);
    expect(await test.db.collection("users").countDocuments({})).toBe(1);
  });

  it("counts a rate-limit window through a real upsert", async () => {
    const key = `integration:${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit(key, 3, 60)).toMatchObject({ ok: true });
    }

    const blocked = await checkRateLimit(key, 3, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("expires rate-limit windows through a TTL index", async () => {
    await checkRateLimit(`ttl:${Date.now()}`, 5, 60);

    const indexes = await test.db.collection("ratelimits").indexes();
    const ttlIndex = indexes.find((i) => i.key?.expiresAt === 1);

    expect(ttlIndex?.expireAfterSeconds).toBe(0);
  });
});
