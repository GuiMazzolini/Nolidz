import Link from "@/app/i18n/Link";
import { fulfillCheckoutSession, getOrderBySessionId } from "@/app/lib/orders";
import ClearCartOnSuccess from "./ClearCartOnSuccess";
import { getT } from "@/app/i18n/server";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const t = await getT();
  const { session_id } = await searchParams;
  let paid = false;
  const lookupHref = session_id
    ? `/orders/lookup?order=${encodeURIComponent(session_id)}`
    : "/orders/lookup";

  // This page is reachable by anyone with a session id, and rendering it used
  // to write to Stripe and the database on a plain GET. Where the webhook is
  // configured it is the only fulfillment path; this fallback exists solely
  // for local development, where `stripe listen` may not be running.
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  if (session_id && !webhookConfigured) {
    try {
      const result = await fulfillCheckoutSession(session_id);
      paid = result.paid;
    } catch {
      paid = false;
    }
  } else if (session_id) {
    // The webhook owns fulfillment; just report whether it has landed yet.
    paid = (await getOrderBySessionId(session_id)) !== null;
  }

  return (
    <div className="min-h-screen bg-paper py-12">
      <ClearCartOnSuccess paid={paid} />
      <div className="container mx-auto px-4 max-w-lg">
        <div className="bg-white border-2 border-ink/10 p-10 text-center">
          <h1 className="font-display italic font-extrabold text-3xl text-ink mb-4">
            {paid ? t.checkoutSuccess.thankYou : t.checkoutSuccess.paymentStatus}
          </h1>
          <p className="text-ink/60 mb-8">
            {paid
              ? t.checkoutSuccess.paidBody
              : session_id
                ? t.checkoutSuccess.unconfirmedBody
                : t.checkoutSuccess.noSessionBody}
          </p>
          <Link
            href="/products"
            className="inline-block bg-ink text-paper px-8 py-3 font-semibold hover:bg-ink/85 transition-colors"
          >
            {t.common.continueShopping}
          </Link>
          <div className="mt-4">
            <Link
              href={lookupHref}
              className="font-semibold text-cardboard-dark hover:text-ink"
            >
              {t.checkoutSuccess.lookUpOrder}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
