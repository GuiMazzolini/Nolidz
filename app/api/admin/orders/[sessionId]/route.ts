import { adminUnauthorized, requireAdmin } from "@/app/lib/admin-auth";
import { markOrderShipped } from "@/app/lib/orders";
import { localeFromRequest } from "@/app/i18n/request";
import { apiDictionaryFor } from "@/app/i18n/lookup";
import { NextRequest, NextResponse } from "next/server";

type Params = { sessionId: string };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const t = apiDictionaryFor(localeFromRequest(req));

  const session = await requireAdmin();
  if (!session) {
    return adminUnauthorized(req);
  }

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: t.missingOrderId }, { status: 400 });
  }

  let body: {
    trackingNumber?: unknown;
    carrier?: unknown;
    sendEmail?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t.invalidJson }, { status: 400 });
  }

  const trackingNumber =
    typeof body.trackingNumber === "string" ? body.trackingNumber.trim() : "";
  if (!trackingNumber) {
    return NextResponse.json(
      { error: t.trackingNumberRequired },
      { status: 400 }
    );
  }

  const carrier =
    typeof body.carrier === "string" && body.carrier.trim()
      ? body.carrier.trim()
      : null;
  const sendEmail = body.sendEmail !== false;

  try {
    const order = await markOrderShipped({
      sessionId,
      trackingNumber,
      carrier,
      sendEmail,
    });

    if (!order) {
      return NextResponse.json({ error: t.orderNotFound }, { status: 404 });
    }

    return NextResponse.json({
      stripeSessionId: order.stripeSessionId,
      status: order.status,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      shippedAt: order.shippedAt,
      emailSent: sendEmail && !!order.customerEmail,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
