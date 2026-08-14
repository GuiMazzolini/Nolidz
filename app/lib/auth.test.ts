import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

import { authOptions } from "@/app/lib/auth";
import { BUYER } from "@/app/test/fixtures";
import { testDb } from "@/app/test/mongo-double";
import type { UserDoc } from "@/app/lib/db-collections";
import type { Account, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

const PASSWORD = "correct-password";

/**
 * next-auth's credentials provider keeps the configured handlers under
 * `options`; the top-level `authorize` is the library's inert default.
 */
function credentialsAuthorize() {
  const provider = authOptions.providers.find((p) => p.id === "credentials");
  const authorize = (provider as unknown as { options: { authorize: unknown } })
    .options.authorize;
  return authorize as (
    credentials: Record<string, string> | undefined,
    req: { headers?: Record<string, string> }
  ) => Promise<User | null>;
}

const req = { headers: { "x-forwarded-for": "203.0.113.9" } };

async function seedUser(overrides: Partial<UserDoc> = {}) {
  testDb.seed("users", [
    {
      _id: "user_1",
      email: BUYER,
      name: "Buyer",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      createdAt: new Date(),
      ...overrides,
    },
  ]);
}

beforeEach(async () => {
  vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  testDb.reset();
  await seedUser();
});

describe("credentials sign-in", () => {
  it("returns the user for a correct password", async () => {
    const user = await credentialsAuthorize()(
      { email: BUYER, password: PASSWORD },
      req
    );

    expect(user).toMatchObject({ email: BUYER, name: "Buyer" });
    // The hash must never travel out with the session user.
    expect(JSON.stringify(user)).not.toContain("$2");
  });

  it("accepts the email in any casing or padding", async () => {
    const user = await credentialsAuthorize()(
      { email: "  BUYER@Example.COM  ", password: PASSWORD },
      req
    );
    expect(user).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    expect(
      await credentialsAuthorize()({ email: BUYER, password: "nope" }, req)
    ).toBeNull();
  });

  it("rejects an unknown account without revealing which part was wrong", async () => {
    expect(
      await credentialsAuthorize()(
        { email: "nobody@example.com", password: PASSWORD },
        req
      )
    ).toBeNull();
  });

  it("rejects an OAuth account that has no password", async () => {
    await seedUser({ passwordHash: undefined, provider: "github" });
    expect(
      await credentialsAuthorize()({ email: BUYER, password: PASSWORD }, req)
    ).toBeNull();
  });

  it("rejects missing credentials", async () => {
    const authorize = credentialsAuthorize();
    expect(await authorize({ email: "", password: "" }, req)).toBeNull();
    expect(await authorize(undefined, req)).toBeNull();
  });

  it("throttles repeated attempts from one IP", async () => {
    const authorize = credentialsAuthorize();

    // The login budget is 10 per window, counted per IP and per email.
    for (let i = 0; i < 10; i++) {
      await authorize({ email: BUYER, password: "wrong" }, req);
    }

    // Correct password, but the budget is spent.
    expect(await authorize({ email: BUYER, password: PASSWORD }, req)).toBeNull();
  });

  it("throttles by account too, so spraying one password is capped", async () => {
    const authorize = credentialsAuthorize();

    for (let i = 0; i < 10; i++) {
      await authorize(
        { email: BUYER, password: "wrong" },
        { headers: { "x-forwarded-for": `198.51.100.${i}` } }
      );
    }

    // A fresh IP, but this account's own budget is exhausted.
    expect(
      await authorize(
        { email: BUYER, password: PASSWORD },
        { headers: { "x-forwarded-for": "198.51.100.200" } }
      )
    ).toBeNull();
  });
});

describe("signIn callback", () => {
  const signIn = authOptions.callbacks!.signIn!;

  it("creates a user record for a first-time OAuth sign-in", async () => {
    const result = await signIn({
      user: { id: "1", email: "New@Example.com", name: "New Person" },
      account: { provider: "github", type: "oauth", providerAccountId: "1" } as Account,
    } as never);

    expect(result).toBe(true);
    const created = testDb.all("users").find((u) => u.email === "new@example.com");
    expect(created).toMatchObject({ provider: "github", name: "New Person" });
  });

  it("does not overwrite an existing record on later OAuth sign-ins", async () => {
    await signIn({
      user: { id: "1", email: BUYER, name: "Renamed By OAuth" },
      account: { provider: "google", type: "oauth", providerAccountId: "1" } as Account,
    } as never);

    const user = testDb.all("users").find((u) => u.email === BUYER);
    expect(user?.name).toBe("Buyer");
    expect(testDb.all("users")).toHaveLength(1);
  });

  it("skips the upsert for credentials sign-ins, which already have a record", async () => {
    await signIn({
      user: { id: "1", email: BUYER, name: "Buyer" },
      account: { provider: "credentials", type: "credentials", providerAccountId: "1" } as Account,
    } as never);

    expect(testDb.all("users")).toHaveLength(1);
  });

  it("refuses a sign-in with no email, which nothing else can key on", async () => {
    const result = await signIn({
      user: { id: "1", email: null, name: "Anon" },
      account: null,
    } as never);
    expect(result).toBe(false);
  });
});

describe("jwt and session callbacks", () => {
  const jwt = authOptions.callbacks!.jwt!;
  const session = authOptions.callbacks!.session!;

  it("flags admin addresses and only those", async () => {
    const asAdmin = await jwt({ token: { email: "admin@example.com" } } as never);
    expect((asAdmin as JWT).isAdmin).toBe(true);

    const asBuyer = await jwt({ token: { email: BUYER } } as never);
    expect((asBuyer as JWT).isAdmin).toBe(false);
  });

  it("ignores an isAdmin claim smuggled into an existing token", async () => {
    const token = await jwt({
      token: { email: BUYER, isAdmin: true },
    } as never);
    expect((token as JWT).isAdmin).toBe(false);
  });

  it("applies a name update without requiring a fresh sign-in", async () => {
    const token = await jwt({
      token: { email: BUYER, name: "Old" },
      trigger: "update",
      session: { name: "New" },
    } as never);
    expect((token as JWT).name).toBe("New");
  });

  it("copies the admin flag and name onto the session", async () => {
    const result = (await session({
      session: { user: { email: BUYER, name: "Old" }, expires: "" },
      token: { isAdmin: true, name: "New" },
    } as never)) as Session;

    expect(result.user).toMatchObject({ isAdmin: true, name: "New" });
  });
});
