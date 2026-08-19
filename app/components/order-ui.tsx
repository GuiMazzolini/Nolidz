import type { Order, OrderItem, ShippingAddress } from "@/app/lib/orders";
import { formatMoney } from "@/app/lib/money";
import { describeTrackingStatus } from "@/app/lib/tracking";
import { DEFAULT_LOCALE, type Locale } from "@/app/i18n/config";
import { getI18n } from "@/app/i18n/server";

/**
 * Order rendering shared by the customer's history, the guest lookup, and the
 * admin fulfillment list.
 *
 * Server Components throughout, so each piece reads the request's locale itself
 * rather than taking a dictionary through three call sites that do not
 * otherwise care about language.
 */

/** Date formatting per language: "18. Aug. 2026, 14:05" vs "18 Aug 2026, 14:05". */
const DATE_LOCALES: Record<Locale, string> = {
  de: "de-DE",
  en: "en-GB",
};

export function formatOrderDate(
  date: Date | string,
  locale: Locale = DEFAULT_LOCALE
): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? "de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatOrderAddress(address: ShippingAddress): string {
  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
    address.country,
  ].filter(Boolean);
  return parts.join("\n");
}

export async function OrderItems({ order }: { order: Order }) {
  const { locale } = await getI18n();

  return (
    <ul className="divide-y divide-gray-100">
      {order.items.map((item: OrderItem, index: number) => (
        <li
          key={`${order.stripeSessionId}-${index}`}
          className="flex justify-between py-3 text-sm"
        >
          <span className="text-gray-900">
            {item.name} <span className="text-gray-500">× {item.quantity}</span>
          </span>
          <span className="font-medium text-gray-900">
            {formatMoney(item.unitAmount * item.quantity, order.currency, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export async function OrderTotals({ order }: { order: Order }) {
  const { locale, t } = await getI18n();
  const money = (amount: number) => formatMoney(amount, order.currency, locale);

  return (
    <div className="border-t border-gray-100 pt-4 space-y-1 text-sm text-gray-600">
      <div className="flex justify-between">
        <span>{t.orders.subtotal}</span>
        <span>{money(order.subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span>{t.orders.shipping}</span>
        <span>
          {order.shippingCost === 0 ? t.common.free : money(order.shippingCost)}
        </span>
      </div>
      <div className="flex justify-between pt-2 text-base font-semibold text-gray-900">
        <span>{t.orders.total}</span>
        <span>{money(order.total)}</span>
      </div>
    </div>
  );
}

export async function OrderShipping({ order }: { order: Order }) {
  if (!order.shippingAddress) return null;
  const { t } = await getI18n();

  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="text-sm font-semibold text-gray-900 mb-1">
        {t.orders.shippedTo}
      </p>
      {order.shippingAddress.name && (
        <p className="text-sm text-gray-700">{order.shippingAddress.name}</p>
      )}
      <p className="text-sm text-gray-600 whitespace-pre-line">
        {formatOrderAddress(order.shippingAddress)}
      </p>
    </div>
  );
}

export async function OrderStatusBadge({ order }: { order: Order }) {
  const { t } = await getI18n();
  const shipped = order.status === "shipped";

  return (
    <span
      className={
        shipped
          ? "rounded-md bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800"
          : "rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
      }
    >
      {shipped ? t.orders.statusShipped : t.orders.statusPaid}
    </span>
  );
}

export async function OrderTracking({ order }: { order: Order }) {
  if (order.status !== "shipped" || !order.trackingNumber) return null;
  const { locale, t } = await getI18n();

  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="text-sm font-semibold text-gray-900 mb-1">
        {t.orders.tracking}
      </p>
      {order.carrier && (
        <p className="text-sm text-gray-600">{t.orders.carrier(order.carrier)}</p>
      )}
      <p className="text-sm font-medium text-gray-900 tracking-wide">
        {order.trackingNumber}
      </p>
      {order.shippedAt && (
        <p className="mt-1 text-xs text-gray-500">
          {t.orders.shippedOn(formatOrderDate(order.shippedAt, locale))}
        </p>
      )}
      {/* Read straight from the cache written by the admin-side refresh. This
          page never calls DHL — a customer reloading their order, or a crawler
          walking every order URL, must not spend the daily budget.

          Our own wording rather than DHL's cached `description`: that string
          arrives in whatever language DHL used at fetch time, which is not
          necessarily the one this reader chose. */}
      {order.tracking && (
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-sm font-medium text-gray-900">
            {describeTrackingStatus(order.tracking.statusCode, t.trackingStatus)}
          </p>
          {order.tracking.location && (
            <p className="text-sm text-gray-600">{order.tracking.location}</p>
          )}
          {order.tracking.eventAt && (
            <p className="mt-1 text-xs text-gray-500">
              {t.orders.lastUpdate(formatOrderDate(order.tracking.eventAt, locale))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
