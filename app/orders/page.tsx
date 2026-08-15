import type { Metadata } from "next";
import { formatMoney } from "@/app/lib/money";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { getOrdersForUser, type Order } from "@/app/lib/orders";
import { redirect } from "next/navigation";
import { formatOrderDate, OrderStatusBadge } from "./order-ui";

export const metadata: Metadata = {
  title: "Order History",
};

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/orders");
  }

  const orders: Order[] = await getOrdersForUser(session.user.email);

  return (
    <div className="min-h-screen bg-paper py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <p className="text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm mb-2">
          Account
        </p>
        <h1 className="font-display italic font-extrabold text-4xl text-ink mb-2 tracking-tight">
          Order History
        </h1>
        <p className="text-ink/60 mb-8">
          Your past purchases. Open an order for items, shipping, and tracking.
        </p>

        {orders.length === 0 ? (
          <div className="bg-white border-2 border-ink/10 p-12 text-center">
            <h2 className="font-display italic font-extrabold text-2xl text-ink mb-3">
              No orders yet
            </h2>
            <p className="text-ink/60 mb-8">
              When you complete a purchase, your orders will show up here.
            </p>
            <Link
              href="/products"
              className="inline-block bg-ink text-paper px-8 py-3 font-semibold hover:bg-ink/85 transition-colors"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden border-2 border-ink/10 bg-white divide-y divide-ink/10">
            {orders.map((order: Order) => (
              <div
                key={order.stripeSessionId}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-ink">
                    {formatOrderDate(order.createdAt)}
                  </p>
                  <OrderStatusBadge order={order} />
                </div>

                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <p className="font-display italic text-lg font-bold text-cardboard-dark">
                    {formatMoney(order.total)}
                  </p>
                  <Link
                    href={`/orders/${order.stripeSessionId}`}
                    className="font-semibold text-cardboard-dark hover:text-ink"
                  >
                    View order details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
