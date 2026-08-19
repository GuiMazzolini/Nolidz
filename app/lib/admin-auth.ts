import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { isAdminEmail } from "@/app/lib/admin";
import { DEFAULT_LOCALE } from "@/app/i18n/config";
import { localeFromRequest } from "@/app/i18n/request";
import { apiDictionaryFor } from "@/app/i18n/lookup";

/**
 * The admin gate for route handlers.
 *
 * Kept apart from `admin.ts` so that `isAdminEmail` stays a pure function any
 * module can import without dragging next-auth in behind it.
 */

/** The session when the caller is an admin, otherwise null. */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return null;
  }
  return session;
}

/** The 401 every admin route returns, so the body cannot drift between them. */
export function adminUnauthorized(req?: Request) {
  const locale = req ? localeFromRequest(req) : DEFAULT_LOCALE;
  return NextResponse.json(
    { error: apiDictionaryFor(locale).unauthorized },
    { status: 401 }
  );
}
