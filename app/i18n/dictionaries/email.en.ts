/**
 * English transactional email copy.
 *
 * Sent from the Stripe webhook and the admin ship action, long after the
 * request that chose the language — which is why the buyer's locale is stored
 * on the order rather than read from a cookie at send time.
 */
const email = {
  brand: "nolidz",

  confirmation: {
    subject: (total: string) => `Your nolidz order confirmation — ${total}`,
    heading: "Thank you for your order",
    intro:
      "We received your payment and your order is confirmed. You can keep shopping anytime.",
    colItem: "Item",
    colQuantity: "Qty",
    colTotal: "Total",
    subtotal: "Subtotal",
    shipping: "Shipping",
    totalPaid: "Total paid",
    shippingTo: "Shipping to",
    cta: "Continue shopping",
  },

  shipped: {
    subject: (carrier: string | null) =>
      `Your nolidz order has shipped${carrier ? ` via ${carrier}` : ""}`,
    heading: "Your order is on the way",
    intro:
      "Good news — we've shipped your order. Use the tracking details below to follow the delivery.",
    tracking: "Tracking",
    carrier: (name: string) => `Carrier: ${name}`,
    cta: "View order details",
  },

  orderReference: (id: string) => `Order reference: ${id}`,

  passwordReset: {
    subject: "Reset your nolidz password",
    heading: "Reset your password",
    intro:
      "We received a request to reset the password for your nolidz account. The button below works for one hour.",
    cta: "Choose a new password",
    ignore:
      "If you did not ask for this, you can ignore this email — your password will not change.",
    expiry: "This link expires in one hour.",
  },
};

export type EmailDict = typeof email;
export default email;
