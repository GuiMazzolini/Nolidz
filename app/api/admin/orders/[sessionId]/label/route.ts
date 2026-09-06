import { connectToDB } from "@/app/api/db";
import { adminUnauthorized, requireAdmin } from "@/app/lib/admin-auth";
import { createLabelForOrder } from "@/app/lib/create-dhl-label";
import { orders } from "@/app/lib/db-collections";
import { toOrder } from "@/app/lib/orders";
import { localeFromRequest } from "@/app/i18n/request";
import { apiDictionaryFor } from "@/app/i18n/lookup";
import { NextRequest, NextResponse } from "next/server";

type Params = { sessionId: string };

/**
 * Stream the stored label PDF with the correct Content-Type.
 * Opening the Cloudinary raw URL directly often fails in the browser
 * ("Failed to load PDF document") when the delivery URL lacks a .pdf suffix
 * or Content-Type.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized(req);

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  const { db } = await connectToDB();
  const doc = await orders(db).findOne({ stripeSessionId: sessionId });
  if (!doc) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  const order = toOrder(doc as Record<string, unknown>);

  const filename = `dhl-label-${sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}.pdf`;

  if (order.labelPdfBase64) {
    const buffer = Buffer.from(order.labelPdfBase64, "base64");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (!order.labelUrl) {
    return NextResponse.json({ error: "No label on this order." }, { status: 404 });
  }

  // Legacy orders: try the stored Cloudinary URL, then with/without .pdf.
  const candidates = [order.labelUrl];
  if (/\.pdf$/i.test(order.labelUrl)) {
    candidates.push(order.labelUrl.replace(/\.pdf$/i, ""));
  } else {
    candidates.push(`${order.labelUrl}.pdf`);
  }

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 5 || buffer.subarray(0, 4).toString() !== "%PDF") {
        continue;
      }
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      // try next candidate
    }
  }

  return NextResponse.json(
    {
      error:
        "Could not download the stored label. Create a new label on a fresh order — older uploads may be corrupt.",
    },
    { status: 502 }
  );
}

/**
 * Create a DHL Paket label for one paid standard order.
 *
 * Admin-only and never automatic: creating a label can bill postage, so the
 * warehouse must click after reviewing the order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized(req);

  const t = apiDictionaryFor(localeFromRequest(req));
  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: t.missingOrderId }, { status: 400 });
  }

  let sendEmail = true;
  let addressOverride:
    | Partial<{
        name: string;
        line1: string;
        line2: string | null;
        city: string;
        postalCode: string;
      }>
    | undefined;

  try {
    const body = await req.json();
    if (body && typeof body === "object") {
      if ("sendEmail" in body) {
        sendEmail = (body as { sendEmail?: unknown }).sendEmail !== false;
      }
      const addr = (body as { address?: unknown }).address;
      if (addr && typeof addr === "object") {
        const a = addr as Record<string, unknown>;
        addressOverride = {};
        if (typeof a.line1 === "string") addressOverride.line1 = a.line1;
        if (typeof a.name === "string") addressOverride.name = a.name;
        if (typeof a.city === "string") addressOverride.city = a.city;
        if (typeof a.postalCode === "string") {
          addressOverride.postalCode = a.postalCode;
        }
        if (a.line2 === null || typeof a.line2 === "string") {
          addressOverride.line2 = a.line2;
        }
      }
    }
  } catch {
    // Empty body is fine — default to emailing the customer.
  }

  const result = await createLabelForOrder({
    sessionId,
    sendEmail,
    addressOverride,
  });

  if (!result.ok) {
    const [status, error] = describeFailure(result.reason, result.detail);
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({
    created: result.created,
    stripeSessionId: result.order.stripeSessionId,
    status: result.order.status,
    trackingNumber: result.order.trackingNumber,
    carrier: result.order.carrier,
    shippedAt: result.order.shippedAt,
    labelUrl: result.order.labelUrl,
    /** Prefer this — streams PDF with correct Content-Type. */
    labelDownloadPath: `/api/admin/orders/${encodeURIComponent(sessionId)}/label`,
    dhlShipmentNo: result.order.dhlShipmentNo,
    emailSent: result.emailSent,
  });
}

function describeFailure(
  reason: string,
  detail?: string
): [number, string] {
  switch (reason) {
    case "not-found":
      return [404, "Order not found."];
    case "not-configured":
      return [
        503,
        "DHL Parcel DE Shipping credentials are not set on this environment.",
      ];
    case "unsupported":
      return [
        400,
        "One-click labels are only for standard DHL Paket. Paste tracking for Express or other carriers.",
      ];
    case "no-address":
      return [400, "This order has no shipping address."];
    case "unauthorized":
      return [502, "DHL rejected our shipping credentials."];
    case "validation":
      return [400, detail ?? "DHL rejected the shipment details."];
    default:
      return [502, detail ?? "Could not create the DHL label. Try again."];
  }
}
