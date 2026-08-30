import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiresAt,
} from "@/app/lib/password-reset";

describe("password reset tokens", () => {
  it("hashes deterministically so only the digest is stored", () => {
    const token = "example-token";
    expect(hashPasswordResetToken(token)).toBe(hashPasswordResetToken(token));
    expect(hashPasswordResetToken(token)).not.toBe(token);
  });

  it("generates unique tokens", () => {
    expect(createPasswordResetToken()).not.toBe(createPasswordResetToken());
  });

  it("expires one hour after issue", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(passwordResetExpiresAt(now).toISOString()).toBe(
      "2026-01-01T13:00:00.000Z"
    );
  });
});
