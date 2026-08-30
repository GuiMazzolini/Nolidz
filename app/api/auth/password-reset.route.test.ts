import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("@/app/api/db", async () => {
  const { connectToTestDB } = await import("@/app/test/mongo-double");
  return { connectToDB: connectToTestDB };
});

const { sendPasswordResetEmailMock } = vi.hoisted(() => ({
  sendPasswordResetEmailMock: vi.fn(),
}));

vi.mock("@/app/lib/email", () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { jsonRequest, readResponse } from "@/app/test/http";
import { testDb } from "@/app/test/mongo-double";
import type { UserDoc } from "@/app/lib/db-collections";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiresAt,
} from "@/app/lib/password-reset";

const EMAIL = "buyer@example.com";
const PASSWORD = "correct horse battery";

function users(): UserDoc[] {
  return testDb.all("users") as unknown as UserDoc[];
}

beforeEach(() => {
  testDb.reset();
  sendPasswordResetEmailMock.mockReset();
});

describe("POST /api/auth/forgot-password", () => {
  it("always returns ok and emails password accounts", async () => {
    await testDb.collection("users").insertOne({
      email: EMAIL,
      name: "Buyer",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      createdAt: new Date(),
    });

    const { status, body } = await readResponse<{ ok: boolean }>(
      await forgotPassword(jsonRequest("POST", { email: EMAIL }))
    );

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(sendPasswordResetEmailMock).toHaveBeenCalledOnce();
    expect(users()[0].passwordResetTokenHash).toBeTruthy();
  });

  it("returns ok without emailing unknown addresses", async () => {
    const { status, body } = await readResponse<{ ok: boolean }>(
      await forgotPassword(jsonRequest("POST", { email: "missing@example.com" }))
    );

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("returns ok without emailing OAuth-only accounts", async () => {
    await testDb.collection("users").insertOne({
      email: EMAIL,
      name: "Buyer",
      provider: "google",
      createdAt: new Date(),
    });

    const { status } = await readResponse(
      await forgotPassword(jsonRequest("POST", { email: EMAIL }))
    );

    expect(status).toBe(200);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-password", () => {
  it("replaces the password and clears the reset token", async () => {
    const token = createPasswordResetToken();
    await testDb.collection("users").insertOne({
      email: EMAIL,
      name: "Buyer",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      passwordResetTokenHash: hashPasswordResetToken(token),
      passwordResetExpiresAt: passwordResetExpiresAt(),
      createdAt: new Date(),
    });

    const { status } = await readResponse(
      await resetPassword(
        jsonRequest("POST", { token, newPassword: "brand new password" })
      )
    );

    expect(status).toBe(200);
    const user = users()[0];
    expect(user.passwordResetTokenHash).toBeUndefined();
    expect(user.passwordResetExpiresAt).toBeUndefined();
    expect(await bcrypt.compare("brand new password", user.passwordHash!)).toBe(
      true
    );
  });

  it("rejects expired tokens", async () => {
    const token = createPasswordResetToken();
    await testDb.collection("users").insertOne({
      email: EMAIL,
      name: "Buyer",
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      passwordResetTokenHash: hashPasswordResetToken(token),
      passwordResetExpiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
    });

    const { status } = await readResponse(
      await resetPassword(
        jsonRequest("POST", { token, newPassword: "brand new password" })
      )
    );

    expect(status).toBe(400);
  });
});
