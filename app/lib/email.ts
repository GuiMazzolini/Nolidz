import { Resend } from "resend";
import type { Order } from "@/app/lib/orders";
import { formatMoney } from "@/app/lib/money";
import { getAppUrl } from "@/app/lib/stripe";
import { localePath, type Locale } from "@/app/i18n/config";
import { emailDictionaryFor, type EmailDict } from "@/app/i18n/lookup";

/**
 * Transactional email, in the language the buyer checked out in.
 *
 * `order.locale` is the source of truth rather than anything on the request:
 * the confirmation goes out from a Stripe webhook and the shipping notice from
 * an admin clicking a button, so by the time either runs, the buyer's own
 * request is long gone.
 */

function formatAddress(order: Order): string | null {
  const a = order.shippingAddress;
  if (!a?.line1) return null;

  const lines = [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postalCode].filter(Boolean).join(", "),
    a.country,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildOrderConfirmationHtml(
  order: Order,
  shopUrl: string,
  t: EmailDict
) {
  const money = (amount: number) =>
    formatMoney(amount, order.currency, order.locale);

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#111827;">
            ${item.name}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;">
            ${item.quantity}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;">
            ${money(item.unitAmount * item.quantity)}
          </td>
        </tr>`
    )
    .join("");

  const shipping = formatAddress(order);
  // Links land in the buyer's language, matching the mail around them.
  const shopHref = `${shopUrl}${localePath(order.locale, "/products")}`;

  return `
<!DOCTYPE html>
<html lang="${order.locale}">
  <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;">
          ${t.brand}
        </p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">${t.confirmation.heading}</h1>
        <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">
          ${t.confirmation.intro}
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr>
              <th style="padding:0 0 8px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">${t.confirmation.colItem}</th>
              <th style="padding:0 0 8px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">${t.confirmation.colQuantity}</th>
              <th style="padding:0 0 8px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase;">${t.confirmation.colTotal}</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;display:flex;justify-content:space-between;color:#6b7280;">
            <span>${t.confirmation.subtotal}</span>
            <span>${money(order.subtotal)}</span>
          </p>
          <p style="margin:0 0 8px;display:flex;justify-content:space-between;color:#6b7280;">
            <span>${t.confirmation.shipping}</span>
            <span>${money(order.shippingCost)}</span>
          </p>
          <p style="margin:0;display:flex;justify-content:space-between;font-size:18px;font-weight:700;color:#111827;">
            <span>${t.confirmation.totalPaid}</span>
            <span>${money(order.total)}</span>
          </p>
        </div>

        ${
          shipping
            ? `<div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;">${t.confirmation.shippingTo}</p>
                <p style="margin:0;white-space:pre-line;line-height:1.6;color:#374151;">${shipping}</p>
              </div>`
            : ""
        }

        <a href="${shopHref}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
          ${t.confirmation.cta}
        </a>

        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
          ${t.orderReference(order.stripeSessionId)}
        </p>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Sends a branded order confirmation email. No-op when Resend is not configured.
 * Failures are logged but do not block order fulfillment.
 */
export async function sendOrderConfirmationEmail(order: Order): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const to = order.customerEmail;
  if (!to) return;

  const t = emailDictionaryFor(order.locale);
  const from =
    process.env.RESEND_FROM_EMAIL || `${t.brand} <onboarding@resend.dev>`;
  const shopUrl = getAppUrl();

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to,
      subject: t.confirmation.subject(
        formatMoney(order.total, order.currency, order.locale)
      ),
      html: buildOrderConfirmationHtml(order, shopUrl, t),
    });
  } catch (err) {
    console.error("Failed to send order confirmation email:", err);
  }
}

function buildShippingNotificationHtml(
  order: Order,
  shopUrl: string,
  t: EmailDict
) {
  const carrierLine = order.carrier
    ? `<p style="margin:0 0 8px;color:#6b7280;">${t.shipped.carrier(
        `<strong style="color:#111827;">${order.carrier}</strong>`
      )}</p>`
    : "";

  const orderHref = `${shopUrl}${localePath(
    order.locale,
    `/orders/${encodeURIComponent(order.stripeSessionId)}`
  )}${
    order.customerEmail
      ? `?email=${encodeURIComponent(order.customerEmail)}`
      : ""
  }`;

  return `
<!DOCTYPE html>
<html lang="${order.locale}">
  <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;">
          ${t.brand}
        </p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">${t.shipped.heading}</h1>
        <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">
          ${t.shipped.intro}
        </p>

        <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;">${t.shipped.tracking}</p>
          ${carrierLine}
          <p style="margin:0;font-size:18px;font-weight:700;letter-spacing:0.02em;color:#111827;">
            ${order.trackingNumber}
          </p>
        </div>

        <a href="${orderHref}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
          ${t.shipped.cta}
        </a>

        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
          ${t.orderReference(order.stripeSessionId)}
        </p>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Notifies the customer that their order has shipped. No-op without Resend config.
 */
export async function sendShippingNotificationEmail(order: Order): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const to = order.customerEmail;
  if (!to || !order.trackingNumber) return;

  const t = emailDictionaryFor(order.locale);
  const from =
    process.env.RESEND_FROM_EMAIL || `${t.brand} <onboarding@resend.dev>`;
  const shopUrl = getAppUrl();
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to,
      subject: t.shipped.subject(order.carrier),
      html: buildShippingNotificationHtml(order, shopUrl, t),
    });
  } catch (err) {
    console.error("Failed to send shipping notification email:", err);
  }
}

function buildPasswordResetHtml(resetUrl: string, t: EmailDict) {
  return `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;">
          ${t.brand}
        </p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">${t.passwordReset.heading}</h1>
        <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">
          ${t.passwordReset.intro}
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
          ${t.passwordReset.cta}
        </a>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
          ${t.passwordReset.expiry}
        </p>
        <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
          ${t.passwordReset.ignore}
        </p>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Sends a one-time password reset link. No-op without Resend config.
 */
export async function sendPasswordResetEmail({
  to,
  token,
  locale,
}: {
  to: string;
  token: string;
  locale: Locale;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const t = emailDictionaryFor(locale);
  const from =
    process.env.RESEND_FROM_EMAIL || `${t.brand} <onboarding@resend.dev>`;
  const shopUrl = getAppUrl();
  const resetUrl = `${shopUrl}${localePath(locale, "/reset-password")}?token=${encodeURIComponent(token)}`;

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to,
      subject: t.passwordReset.subject,
      html: buildPasswordResetHtml(resetUrl, t),
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err);
  }
}
