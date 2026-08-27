import type { Metadata } from "next";
import { formatMoney } from "@/app/lib/money";
import Link from "@/app/i18n/Link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { getAccessibleOrder } from "@/app/lib/orders";
import {
  formatOrderDate,
  OrderItems,
  OrderShipping,
  OrderStatusBadge,
  OrderTotals,
  OrderTracking,
} from "@/app/components/order-ui";
import { getI18n } from "@/app/i18n/server";

type Props = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ email?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.orders.detailMetaTitle };
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: Props) {
  const { locale, t } = await getI18n();
  const [{ sessionId }, { email }] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);

  const order = await getAccessibleOrder({
    sessionId,
    sessionEmail: session?.user?.email,
    guestEmail: email,
  });

  if (!order) {
    return (
      <div className="min-h-screen bg-paper py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {t.orders.notFoundHeading}
            </h1>
            <p className="text-gray-600 mb-8">{t.orders.notFoundBody}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/orders/lookup?order=${encodeURIComponent(sessionId)}`}
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {t.orders.guestLookupCta}
              </Link>
              <Link
                href="/orders"
                className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                {t.orders.backToOrdersPlain}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              {t.orders.detailHeading}
            </h1>
            <p className="text-gray-600 mt-2">
              {t.orders.orderReference}{" "}
              <span className="font-mono text-sm">{order.stripeSessionId}</span>
            </p>
          </div>
          <Link
            href="/orders"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {t.orders.backToOrders}
          </Link>
        </div>

        <article className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 bg-gray-50">
            <div>
              <p className="text-sm text-gray-500">{t.orders.orderPlaced}</p>
              <p className="font-semibold text-gray-900">
                {formatOrderDate(order.createdAt, locale)}
              </p>
            </div>
            <div className="text-right space-y-2">
              <OrderStatusBadge order={order} />
              <p className="text-sm text-gray-500">{t.orders.totalPaid}</p>
              <p className="text-xl font-bold text-blue-600">
                {formatMoney(order.total, order.currency, locale)}
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <OrderItems order={order} />
            <OrderTotals order={order} />
            <OrderShipping order={order} />
            <OrderTracking order={order} />
          </div>
        </article>

        <aside className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink/10 bg-white px-6 py-4">
          <p className="text-sm text-gray-600">{t.orders.returnsNote}</p>
          <Link
            href="/returns"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {t.orders.returnsCta}
          </Link>
        </aside>
      </div>
    </div>
  );
}

