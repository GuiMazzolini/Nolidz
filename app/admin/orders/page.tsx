import type { Metadata } from "next";
import { formatMoney } from "@/app/lib/money";
import Link from "next/link";
import { getAllOrders } from "@/app/lib/orders";
import { formatOrderDate } from "@/app/orders/order-ui";
import { canRefreshTracking, describeTrackingStatus } from "@/app/lib/tracking";
import { isTrackableCarrier } from "@/app/lib/carriers";
import ShipOrderForm from "./ShipOrderForm";
import RefreshTrackingButton from "./RefreshTrackingButton";

export const metadata: Metadata = {
  title: "Admin — Orders",
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();
  const awaitingShipment = orders.filter((o) => o.status !== "shipped").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm mb-2">
          Fulfillment
        </p>
        <h2 className="font-display italic font-extrabold text-3xl text-ink tracking-tight mb-2">
          Orders
        </h2>
        <p className="text-ink/60">
          {orders.length} order{orders.length === 1 ? "" : "s"}
          {awaitingShipment > 0
            ? ` · ${awaitingShipment} awaiting shipment`
            : ""}
          . After you ship with DHL (or another carrier), add the tracking number
          below.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="border-2 border-dashed border-ink/20 bg-white p-10 text-center text-ink/45">
          No orders yet. Complete a test checkout to see fulfillment here.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article
              key={order.stripeSessionId}
              className="overflow-hidden border-2 border-ink/10 bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink/10 bg-paper px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        order.status === "shipped"
                          ? "bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800"
                          : "bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                      }
                    >
                      {order.status === "shipped" ? "Shipped" : "Paid — pack & ship"}
                    </span>
                    <p className="text-sm text-ink/45">
                      {formatOrderDate(order.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1 font-medium text-ink">
                    {order.customerEmail ?? order.userId}
                  </p>
                  <p className="font-mono text-xs text-ink/45">
                    {order.stripeSessionId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display italic text-lg font-bold text-cardboard-dark">
                    {formatMoney(order.total)}
                  </p>
                  <Link
                    href={`/orders/${encodeURIComponent(order.stripeSessionId)}${
                      order.customerEmail
                        ? `?email=${encodeURIComponent(order.customerEmail)}`
                        : ""
                    }`}
                    className="text-sm font-medium text-cardboard-dark hover:text-ink"
                  >
                    Customer view
                  </Link>
                </div>
              </div>

              <div className="grid gap-5 px-5 py-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">Items</p>
                  <ul className="space-y-1 text-sm text-ink/75">
                    {order.items.map((item, i) => (
                      <li key={`${order.stripeSessionId}-${i}`}>
                        {item.name} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                  {order.shippingAddress && (
                    <div className="mt-4">
                      <p className="mb-1 text-sm font-semibold text-ink">
                        Ship to
                      </p>
                      <p className="text-sm text-ink/60 whitespace-pre-line">
                        {[
                          order.shippingAddress.name,
                          order.shippingAddress.line1,
                          order.shippingAddress.line2,
                          [
                            order.shippingAddress.city,
                            order.shippingAddress.state,
                            order.shippingAddress.postalCode,
                          ]
                            .filter(Boolean)
                            .join(", "),
                          order.shippingAddress.country,
                        ]
                          .filter(Boolean)
                          .join("\n")}
                      </p>
                    </div>
                  )}
                  {order.status === "shipped" && order.trackingNumber && (
                    <div className="mt-4 border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                      <p className="font-semibold">
                        Tracking: {order.trackingNumber}
                      </p>
                      {order.carrier && <p>Carrier: {order.carrier}</p>}
                      {order.shippedAt && (
                        <p className="text-xs text-green-800 mt-1">
                          Marked shipped {formatOrderDate(order.shippedAt)}
                        </p>
                      )}
                      {order.tracking && (
                        <p className="mt-2 border-t border-green-200 pt-2">
                          <span className="font-semibold">
                            DHL:{" "}
                            {order.tracking.description ??
                              describeTrackingStatus(order.tracking.statusCode)}
                          </span>
                          {order.tracking.location && (
                            <span> · {order.tracking.location}</span>
                          )}
                          <span className="mt-0.5 block text-xs text-green-800">
                            Checked {formatOrderDate(order.tracking.checkedAt)}
                          </span>
                        </p>
                      )}
                      <RefreshTrackingButton
                        sessionId={order.stripeSessionId}
                        canRefresh={
                          isTrackableCarrier(order.carrier) &&
                          canRefreshTracking(order.tracking)
                        }
                        carrierSupported={isTrackableCarrier(order.carrier)}
                      />
                    </div>
                  )}
                </div>

                <ShipOrderForm
                  sessionId={order.stripeSessionId}
                  initialTracking={order.trackingNumber ?? ""}
                  initialCarrier={order.carrier ?? ""}
                  alreadyShipped={order.status === "shipped"}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
