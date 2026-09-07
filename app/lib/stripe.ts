import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

/**
 * True when Stripe rejected a Customer id that does not exist in this mode
 * (typical after switching from test keys to live on the same user records).
 */
export function isMissingStripeCustomer(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; param?: string; message?: string };
  if (e.code !== "resource_missing") return false;
  if (e.param === "customer") return true;
  return typeof e.message === "string" && /no such customer/i.test(e.message);
}

export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
