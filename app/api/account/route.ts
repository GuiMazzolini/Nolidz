import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { connectToDB } from "@/app/api/db";
import { authOptions } from "@/app/lib/auth";
import { getAccountProfile } from "@/app/lib/account";
import { carts, users } from "@/app/lib/db-collections";
import { normalizeEmail } from "@/app/lib/normalize-email";
import { unauthorized } from "@/app/lib/api-request";
import { localeFromRequest } from "@/app/i18n/request";
import { apiDictionaryFor } from "@/app/i18n/lookup";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return unauthorized(req);

  const profile = await getAccountProfile(session.user.email);
  if (!profile) {
    return NextResponse.json(
      { error: apiDictionaryFor(localeFromRequest(req)).accountNotFound },
      { status: 404 }
    );
  }
  return NextResponse.json(profile);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return unauthorized(req);

  const email = normalizeEmail(session.user.email);
  const { db } = await connectToDB();

  const result = await users(db).deleteOne({ email });
  if (result.deletedCount === 0) {
    return NextResponse.json(
      { error: apiDictionaryFor(localeFromRequest(req)).accountNotFound },
      { status: 404 }
    );
  }

  await carts(db).deleteOne({ userId: email });

  // Orders are deliberately kept: they are financial records, and the guest
  // lookup by email + session id must keep working after an account is gone.
  return NextResponse.json({ ok: true });
}
