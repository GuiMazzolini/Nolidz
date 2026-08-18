import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { isAdminEmail } from "@/app/lib/admin";

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
export function adminUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
