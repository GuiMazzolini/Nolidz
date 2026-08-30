import { NextResponse } from "next/server";
import { connectToDB } from "@/app/api/db";
import { localeFromRequest } from "@/app/i18n/request";
import { users } from "@/app/lib/db-collections";
import { parseBody } from "@/app/lib/api-request";
import { sendPasswordResetEmail } from "@/app/lib/email";
import { normalizeEmail } from "@/app/lib/normalize-email";
import {
  checkRateLimit,
  enforceRateLimit,
  RATE_LIMITS,
  tooManyRequests,
} from "@/app/lib/rate-limit";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiresAt,
} from "@/app/lib/password-reset";
import { forgotPasswordSchema } from "@/app/lib/schemas";

export async function POST(request: Request) {
  const { limit, windowSec } = RATE_LIMITS.forgotPassword;
  const limited = await enforceRateLimit(request, "forgot-password", limit, windowSec);
  if (limited) return limited;

  const parsed = await parseBody(request, forgotPasswordSchema);
  if (!parsed.ok) return parsed.response;

  const email = normalizeEmail(parsed.data.email);
  const byEmail = await checkRateLimit(
    `forgot-password:email:${email}`,
    3,
    windowSec
  );
  if (!byEmail.ok) {
    return tooManyRequests(byEmail.retryAfter, request);
  }

  const { db } = await connectToDB();
  const user = await users(db).findOne({ email });

  // Only password accounts get a link. OAuth accounts have no password to reset.
  // The response is always the same so callers cannot probe which emails exist.
  if (user?.passwordHash) {
    const token = createPasswordResetToken();
    await users(db).updateOne(
      { email },
      {
        $set: {
          passwordResetTokenHash: hashPasswordResetToken(token),
          passwordResetExpiresAt: passwordResetExpiresAt(),
          updatedAt: new Date(),
        },
      }
    );

    await sendPasswordResetEmail({
      to: email,
      token,
      locale: localeFromRequest(request),
    });
  }

  return NextResponse.json({ ok: true });
}
