import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDB } from "@/app/api/db";
import { localeFromRequest } from "@/app/i18n/request";
import { apiDictionaryFor } from "@/app/i18n/lookup";
import { users } from "@/app/lib/db-collections";
import { parseBody } from "@/app/lib/api-request";
import { hashPasswordResetToken } from "@/app/lib/password-reset";
import { enforceRateLimit, RATE_LIMITS } from "@/app/lib/rate-limit";
import { resetPasswordSchema } from "@/app/lib/schemas";

export async function POST(request: Request) {
  const { limit, windowSec } = RATE_LIMITS.resetPassword;
  const limited = await enforceRateLimit(request, "reset-password", limit, windowSec);
  if (limited) return limited;

  const t = apiDictionaryFor(localeFromRequest(request));
  const parsed = await parseBody(request, resetPasswordSchema);
  if (!parsed.ok) return parsed.response;

  const { token, newPassword } = parsed.data;
  const tokenHash = hashPasswordResetToken(token);
  const { db } = await connectToDB();

  const user = await users(db).findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return NextResponse.json({ error: t.invalidResetToken }, { status: 400 });
  }

  await users(db).updateOne(
    { email: user.email },
    {
      $set: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        updatedAt: new Date(),
      },
      $unset: {
        passwordResetTokenHash: "",
        passwordResetExpiresAt: "",
      },
    }
  );

  return NextResponse.json({ ok: true });
}
