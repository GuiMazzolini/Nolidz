import { createHash, randomBytes } from "crypto";

/** How long a reset link stays valid. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Store only the hash — a database leak must not hand out usable links. */
export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordResetExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
}
