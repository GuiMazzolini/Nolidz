import type { Metadata } from "next";
import { formatMoney } from "@/app/lib/money";
import Link from "@/app/i18n/Link";
import { getAccessibleOrder } from "@/app/lib/orders";
import {
  formatOrderDate,
  OrderItems,
  OrderTotals,
} from "@/app/components/order-ui";
import { getI18n } from "@/app/i18n/server";

type Props = {
  searchParams: Promise<{ order?: string; email?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.orders.lookupMetaTitle };
}

export default async function GuestOrderLookupPage({ searchParams }: Props) {
  const { locale, t, path } = await getI18n();
  const { order, email } = await searchParams;

  const normalizedOrder = order?.trim() || "";
  const normalizedEmail = email?.trim() || "";

  const result =
    normalizedOrder && normalizedEmail
      ? await getAccessibleOrder({
          sessionId: normalizedOrder,
          guestEmail: normalizedEmail,
        })
      : null;

  const lookupAttempted = Boolean(normalizedOrder && normalizedEmail);
  const detailHref =
    result && normalizedEmail
      ? `/orders/${result.stripeSessionId}?email=${encodeURIComponent(
          normalizedEmail
        )}`
      : null;

  return (
    <div className="min-h-screen bg-paper py-12">
      <div className="container mx-auto px-4 max-w-3xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t.orders.lookupHeading}
          </h1>
          <p className="text-gray-600">{t.orders.lookupIntro}</p>
        </div>

        <form
          action={path("/orders/lookup")}
          method="GET"
          className="rounded-2xl bg-white shadow-lg p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t.orders.lookupEmailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={normalizedEmail}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label
              htmlFor="order"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t.orders.lookupReferenceLabel}
            </label>
            <input
              id="order"
              name="order"
              defaultValue={normalizedOrder}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            />
          </div>

          <button
            type="submit"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            {t.orders.lookupSubmit}
          </button>
        </form>

        {lookupAttempted && !result && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {t.orders.lookupNoMatch}
          </div>
        )}

        {result && detailHref && (
          <article className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 bg-gray-50">
              <div>
                <p className="text-sm text-gray-500">{t.orders.orderPlaced}</p>
                <p className="font-semibold text-gray-900">
                  {formatOrderDate(result.createdAt, locale)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">{t.orders.total}</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatMoney(result.total, result.currency, locale)}
                </p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <OrderItems order={result} />
              <OrderTotals order={result} />
              <div className="border-t border-gray-100 pt-4">
                <Link
                  href={detailHref}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  {t.orders.lookupViewFull}
                </Link>
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

