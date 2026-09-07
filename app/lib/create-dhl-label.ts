/**
 * Admin one-click DHL Paket label: call Parcel DE Shipping, store the PDF,
 * mark the order shipped. Never invoked from Stripe payment.
 */

import { connectToDB } from "@/app/api/db";
import { fetchLabelPdfBuffer, uploadLabelPdf } from "@/app/lib/cloudinary";
import {
  createPaketLabel,
  DhlShippingNotConfiguredError,
  isDhlShippingConfigured,
  orderSupportsPaketLabel,
} from "@/app/lib/dhl-shipping";
import { sendShippingNotificationEmail } from "@/app/lib/email";
import { orders } from "@/app/lib/db-collections";
import { toOrder, type Order } from "@/app/lib/orders";

export type CreateLabelOutcome =
  | { ok: true; order: Order; created: true; emailSent: boolean }
  | { ok: true; order: Order; created: false; emailSent: false }
  | {
      ok: false;
      reason:
        | "not-found"
        | "not-configured"
        | "unsupported"
        | "no-address"
        | "unauthorized"
        | "validation"
        | "error";
      detail?: string;
    };

function labelPublicIdForSession(sessionId: string): string {
  // Cloudinary public ids: keep path-safe characters only.
  return `order-${sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)}`;
}

function refNoForSession(sessionId: string): string {
  // DHL wants at least 8 characters for a useful reference.
  const cleaned = sessionId.replace(/[^a-zA-Z0-9]/g, "");
  return (cleaned.length >= 8 ? cleaned : `nolidz${cleaned}`).slice(0, 35);
}

export async function createLabelForOrder({
  sessionId,
  sendEmail = true,
  addressOverride,
  weightKg,
}: {
  sessionId: string;
  sendEmail?: boolean;
  /** Fix street / house number before calling DHL (persisted on the order). */
  addressOverride?: Partial<{
    name: string;
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
  }>;
  /** Parcel weight in kg. Falls back to DHL_DEFAULT_WEIGHT_KG / 1. */
  weightKg?: number;
}): Promise<CreateLabelOutcome> {
  if (!isDhlShippingConfigured()) {
    return { ok: false, reason: "not-configured" };
  }

  if (
    weightKg !== undefined &&
    (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 31.5)
  ) {
    return {
      ok: false,
      reason: "validation",
      detail: "Weight must be between 0 and 31.5 kg.",
    };
  }

  const { db } = await connectToDB();
  const existing = await orders(db).findOne({ stripeSessionId: sessionId });
  if (!existing) return { ok: false, reason: "not-found" };

  let order = toOrder(existing as Record<string, unknown>);

  // Idempotent: already has a stored label — do not bill DHL again.
  if ((order.labelPdfBase64 || order.labelUrl) && order.trackingNumber) {
    return { ok: true, order, created: false, emailSent: false };
  }

  // Manual ship already set tracking — do not create a second billed shipment.
  if (order.trackingNumber || order.status === "shipped") {
    return { ok: false, reason: "unsupported" };
  }

  if (order.shippingMethod !== "standard") {
    return { ok: false, reason: "unsupported" };
  }
  if (!order.shippingAddress) {
    return { ok: false, reason: "no-address" };
  }
  if (!orderSupportsPaketLabel(order)) {
    return { ok: false, reason: "unsupported" };
  }

  const consignee = {
    ...order.shippingAddress,
    ...(addressOverride?.name !== undefined
      ? { name: addressOverride.name.trim() || order.shippingAddress.name }
      : {}),
    ...(addressOverride?.line1 !== undefined
      ? { line1: addressOverride.line1.trim() }
      : {}),
    ...(addressOverride?.line2 !== undefined
      ? { line2: addressOverride.line2?.trim() || null }
      : {}),
    ...(addressOverride?.city !== undefined
      ? { city: addressOverride.city.trim() }
      : {}),
    ...(addressOverride?.postalCode !== undefined
      ? { postalCode: addressOverride.postalCode.trim() }
      : {}),
  };

  if (!consignee.line1) {
    return {
      ok: false,
      reason: "validation",
      detail: "Street and house number are required (e.g. Schönleinstraße 15).",
    };
  }

  // Persist corrections so the admin view matches what DHL printed.
  if (addressOverride) {
    await orders(db).updateOne(
      { stripeSessionId: sessionId },
      { $set: { shippingAddress: consignee } }
    );
    order = { ...order, shippingAddress: consignee };
  }

  let dhlResult;
  try {
    dhlResult = await createPaketLabel({
      refNo: refNoForSession(sessionId),
      consignee,
      ...(weightKg !== undefined ? { weightKg } : {}),
    });
  } catch (err) {
    if (err instanceof DhlShippingNotConfiguredError) {
      return { ok: false, reason: "not-configured" };
    }
    const detail = err instanceof Error ? err.message : "DHL error";
    return { ok: false, reason: "error", detail };
  }

  if (!dhlResult.ok) {
    if (dhlResult.reason === "unauthorized") {
      return { ok: false, reason: "unauthorized" };
    }
    if (dhlResult.reason === "validation") {
      return { ok: false, reason: "validation", detail: dhlResult.detail };
    }
    return { ok: false, reason: "error", detail: dhlResult.detail };
  }

  let pdfBuffer = dhlResult.label.pdfBuffer;
  if (!pdfBuffer && dhlResult.label.labelUrl) {
    try {
      pdfBuffer = await fetchLabelPdfBuffer(dhlResult.label.labelUrl);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "label download failed";
      return { ok: false, reason: "error", detail };
    }
  }
  if (!pdfBuffer) {
    return { ok: false, reason: "error", detail: "No label PDF returned" };
  }

  // Sanity-check: a real PDF starts with %PDF
  if (!pdfBuffer.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    return {
      ok: false,
      reason: "error",
      detail: "DHL returned a label that is not a valid PDF",
    };
  }

  // Prefer keeping the PDF bytes on the order. Cloudinary is best-effort only —
  // raw delivery URLs have been unreliable for browser PDF viewers.
  const labelPdfBase64 = pdfBuffer.toString("base64");

  let uploaded: { url: string; publicId: string } | null = null;
  try {
    uploaded = await uploadLabelPdf({
      buffer: pdfBuffer,
      publicId: labelPublicIdForSession(sessionId),
    });
  } catch (err) {
    console.error("Cloudinary label upload failed (PDF still saved on order):", err);
  }

  const shippedAt = new Date();
  const result = await orders(db).findOneAndUpdate(
    { stripeSessionId: sessionId },
    {
      $set: {
        status: "shipped",
        trackingNumber: dhlResult.label.trackingNumber,
        carrier: "DHL",
        shippedAt,
        labelUrl: uploaded?.url ?? null,
        labelPublicId: uploaded?.publicId ?? null,
        labelPdfBase64,
        dhlShipmentNo: dhlResult.label.shipmentNo,
        shippingAddress: consignee,
      },
    },
    { returnDocument: "after" }
  );

  const doc = result as Record<string, unknown> | null;
  if (!doc) return { ok: false, reason: "not-found" };

  const updated = toOrder(doc);
  let emailSent = false;
  if (sendEmail) {
    await sendShippingNotificationEmail(updated);
    emailSent = Boolean(updated.customerEmail);
  }

  return { ok: true, order: updated, created: true, emailSent };
}
