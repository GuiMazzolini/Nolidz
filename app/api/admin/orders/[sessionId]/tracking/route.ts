import { connectToDB } from "@/app/api/db";
import { adminUnauthorized, requireAdmin } from "@/app/lib/admin-auth";
import { describeTrackingStatus, refreshTrackingForOrder } from "@/app/lib/tracking";
import { NextRequest, NextResponse } from "next/server";

type Params = { sessionId: string };

/**
 * Pull the current DHL status for one order.
 *
 * Admin-only, and not because the status is secret — the customer sees it on
 * their own order page. It is because this is the only route in the app that
 * can spend the daily DHL budget, and leaving it open would let anyone drain
 * 250 requests in a minute. Customer-facing pages read the cache instead and
 * never reach DHL.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  // `force` skips the six-hour floor for an admin who has a customer on the
  // phone. It cannot revive a delivered parcel — see refreshTrackingForOrder.
  let force = false;
  try {
    const body = await req.json();
    force = body?.force === true;
  } catch {
    // No body is the normal case.
  }

  const { db } = await connectToDB();
  const result = await refreshTrackingForOrder(db, sessionId, { force });

  if (!result.ok) {
    const [status, error] = describeFailure(result.reason);
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({
    refreshed: result.refreshed,
    statusCode: result.tracking.statusCode,
    // DHL's own line when it has one, our wording when it does not.
    description:
      result.tracking.description ?? describeTrackingStatus(result.tracking.statusCode),
    location: result.tracking.location,
    eventAt: result.tracking.eventAt,
    checkedAt: result.tracking.checkedAt,
  });
}

/** Each reason gets the status code that tells the admin what to do next. */
function describeFailure(reason: string): [number, string] {
  switch (reason) {
    case "no-tracking-number":
      return [400, "This order has no tracking number yet."];
    case "carrier-not-supported":
      return [400, "We can only check DHL parcels. Track this one on the carrier's own site."];
    case "not-configured":
      return [503, "DHL_API_KEY is not set on this environment."];
    case "throttled":
      return [429, "Already checked recently — try again later."];
    case "not-found":
      return [404, "DHL has not registered this tracking number yet."];
    case "rate-limited":
      return [429, "DHL daily request limit reached. Try again tomorrow."];
    case "unauthorized":
      return [502, "DHL rejected our API key."];
    default:
      return [502, "Could not reach DHL. Try again."];
  }
}
