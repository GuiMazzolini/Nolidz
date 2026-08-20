import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const { customersCreateMock, customersUpdateMock } = vi.hoisted(() => ({
  customersCreateMock: vi.fn(),
  customersUpdateMock: vi.fn(),
}));

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

vi.mock("next-auth", async () => {
  const { getMockSession } = await import("@/app/test/session");
  return { getServerSession: async () => getMockSession() };
});

vi.mock("@/app/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/app/lib/stripe", () => ({
  getStripe: () => ({
    customers: { create: customersCreateMock, update: customersUpdateMock },
  }),
}));

import { DELETE as DELETE_ACCOUNT } from "@/app/api/account/route";
import { PATCH as PATCH_PROFILE } from "@/app/api/account/profile/route";
import { PUT as PUT_PASSWORD } from "@/app/api/account/password/route";
import {
  DELETE as DELETE_ADDRESS,
  PUT as PUT_ADDRESS,
} from "@/app/api/account/address/route";
import { getAccountProfile, type AccountProfile } from "@/app/lib/account";
import type { UserDoc } from "@/app/lib/db-collections";
import { BUYER } from "@/app/test/fixtures";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import { setEmaillessSession, setMockSession } from "@/app/test/session";

const PASSWORD = "original-password";
const address = {
  line1: "Musterstraße 1",
  line2: null,
  city: "Berlin",
  state: null,
  postalCode: "10115",
  country: "de",
};

function storedUser(email = BUYER): UserDoc | undefined {
  return testDb.all("users").find((doc) => doc.email === email) as
    | UserDoc
    | undefined;
}

async function seedUser(overrides: Partial<UserDoc> = {}) {
  testDb.seed("users", [
    {
      email: BUYER,
      name: "Buyer",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      provider: "credentials",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      ...overrides,
    },
  ]);
}

beforeEach(async () => {
  vi.clearAllMocks();
  customersCreateMock.mockResolvedValue({ id: "cus_new" });
  customersUpdateMock.mockResolvedValue({ id: "cus_existing" });
  testDb.reset();
  await seedUser();
  setMockSession(BUYER);
});

describe("account access control", () => {
  it("refuses every account route without a session", async () => {
    setMockSession(null);

    const responses = await Promise.all([
      DELETE_ACCOUNT(jsonRequest("DELETE")),
      PATCH_PROFILE(jsonRequest("PATCH", { name: "Mallory" })),
      PUT_PASSWORD(jsonRequest("PUT", { newPassword: "new-password" })),
      PUT_ADDRESS(jsonRequest("PUT", address)),
      DELETE_ADDRESS(jsonRequest("DELETE")),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
    expect(storedUser()?.name).toBe("Buyer");
  });

  it("treats a session with no email as unauthenticated", async () => {
    setEmaillessSession();
    expect((await DELETE_ACCOUNT(jsonRequest("DELETE"))).status).toBe(401);
  });

  it("404s when the session points at a deleted account", async () => {
    setMockSession("ghost@example.com");
    expect((await DELETE_ACCOUNT(jsonRequest("DELETE"))).status).toBe(404);
  });
});

describe("getAccountProfile", () => {
  it("returns the profile and never the password hash", async () => {
    const body = await getAccountProfile(BUYER);

    expect(body).toMatchObject({
      email: BUYER,
      name: "Buyer",
      hasPassword: true,
      provider: "credentials",
      address: null,
    });
    expect(JSON.stringify(body)).not.toContain("$2");
  });

  it("matches the account regardless of email casing", async () => {
    const body = await getAccountProfile("BUYER@Example.com");
    expect(body?.email).toBe(BUYER);
  });
});

describe("PATCH /api/account/profile", () => {
  it("renames the account and echoes the updated profile", async () => {
    const { status, body } = await readResponse<AccountProfile>(
      await PATCH_PROFILE(jsonRequest("PATCH", { name: "  Ada  " }))
    );

    expect(status).toBe(200);
    expect(body.name).toBe("Ada");
    expect(storedUser()?.name).toBe("Ada");
  });

  it("rejects a blank or oversized name", async () => {
    for (const name of ["   ", "a".repeat(101), 42]) {
      const res = await PATCH_PROFILE(jsonRequest("PATCH", { name }));
      expect(res.status).toBe(400);
    }
    expect(storedUser()?.name).toBe("Buyer");
  });
});

describe("PUT /api/account/password", () => {
  it("changes the password when the current one is proven", async () => {
    const { status } = await readResponse(
      await PUT_PASSWORD(
        jsonRequest("PUT", {
          currentPassword: PASSWORD,
          newPassword: "a-brand-new-password",
        })
      )
    );

    expect(status).toBe(200);
    await expect(
      bcrypt.compare("a-brand-new-password", storedUser()!.passwordHash!)
    ).resolves.toBe(true);
  });

  it("403s a wrong current password and leaves the old one working", async () => {
    const { status, body } = await readResponse<{ error: string }>(
      await PUT_PASSWORD(
        jsonRequest("PUT", {
          currentPassword: "not-it",
          newPassword: "a-brand-new-password",
        })
      )
    );

    expect(status).toBe(403);
    expect(body.error).toContain("incorrect");
    await expect(
      bcrypt.compare(PASSWORD, storedUser()!.passwordHash!)
    ).resolves.toBe(true);
  });

  it("requires the current password when one is set", async () => {
    // A stolen session must not be enough to lock the owner out.
    const { status, body } = await readResponse<{ error: string }>(
      await PUT_PASSWORD(jsonRequest("PUT", { newPassword: "a-brand-new-password" }))
    );

    expect(status).toBe(400);
    expect(body.error).toContain("current password is required");
  });

  it("refuses reusing the same password", async () => {
    const { status } = await readResponse(
      await PUT_PASSWORD(
        jsonRequest("PUT", { currentPassword: PASSWORD, newPassword: PASSWORD })
      )
    );
    expect(status).toBe(400);
  });

  it("lets an OAuth account set its first password without proving one", async () => {
    await seedUser({ passwordHash: undefined, provider: "github" });

    const { status, body } = await readResponse<{ hasPassword: boolean }>(
      await PUT_PASSWORD(jsonRequest("PUT", { newPassword: "first-password" }))
    );

    expect(status).toBe(200);
    expect(body.hasPassword).toBe(true);
    await expect(
      bcrypt.compare("first-password", storedUser()!.passwordHash!)
    ).resolves.toBe(true);
  });

  it("rejects a new password under the minimum length", async () => {
    const res = await PUT_PASSWORD(
      jsonRequest("PUT", { currentPassword: PASSWORD, newPassword: "short" })
    );
    expect(res.status).toBe(400);
  });

  it("is rate limited on the same budget as login", async () => {
    const attempt = () =>
      PUT_PASSWORD(
        jsonRequest("PUT", { currentPassword: "wrong", newPassword: "another-password" })
      );

    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(403);
    }
    expect((await attempt()).status).toBe(429);
  });
});

describe("PUT /api/account/address", () => {
  it("saves the address, upper-cases the country, and creates a Stripe customer", async () => {
    const { status, body } = await readResponse<AccountProfile>(
      await PUT_ADDRESS(jsonRequest("PUT", address))
    );

    expect(status).toBe(200);
    expect(body.address).toMatchObject({ city: "Berlin", country: "DE" });
    expect(customersCreateMock).toHaveBeenCalledOnce();
    expect(storedUser()?.stripeCustomerId).toBe("cus_new");
  });

  it("updates the existing Stripe customer instead of creating another", async () => {
    await seedUser({ stripeCustomerId: "cus_existing" });

    await PUT_ADDRESS(jsonRequest("PUT", address));

    expect(customersUpdateMock).toHaveBeenCalledWith(
      "cus_existing",
      expect.objectContaining({ name: "Buyer" })
    );
    expect(customersCreateMock).not.toHaveBeenCalled();
  });

  it("still saves the address when Stripe is failing", async () => {
    customersCreateMock.mockRejectedValueOnce(new Error("stripe down"));

    const { status, body } = await readResponse<AccountProfile>(
      await PUT_ADDRESS(jsonRequest("PUT", address))
    );

    expect(status).toBe(200);
    expect(body.address?.line1).toBe("Musterstraße 1");
    expect(storedUser()?.stripeCustomerId).toBeUndefined();
  });

  it("rejects an incomplete address or a non-German country", async () => {
    const invalid = [
      { ...address, line1: "" },
      { ...address, country: "PRT" },
      { ...address, country: "US" },
      { ...address, postalCode: "" },
    ];

    for (const body of invalid) {
      expect((await PUT_ADDRESS(jsonRequest("PUT", body))).status).toBe(400);
    }
  });

  it("clears a saved address", async () => {
    await PUT_ADDRESS(jsonRequest("PUT", address));

    const { status, body } = await readResponse<AccountProfile>(
      await DELETE_ADDRESS(jsonRequest("DELETE"))
    );

    expect(status).toBe(200);
    expect(body.address).toBeNull();
  });
});

describe("DELETE /api/account", () => {
  it("removes the account and its cart but keeps orders", async () => {
    testDb.seed("carts", [{ userId: BUYER, items: [{ productId: "mug", quantity: 1 }] }]);
    testDb.seed("orders", [{ stripeSessionId: "cs_1", userId: BUYER, items: [] }]);

    const { status } = await readResponse(await DELETE_ACCOUNT(jsonRequest("DELETE")));

    expect(status).toBe(200);
    expect(storedUser()).toBeUndefined();
    expect(testDb.all("carts")).toHaveLength(0);
    // Orders are financial records and outlive the account.
    expect(testDb.all("orders")).toHaveLength(1);
  });
});
