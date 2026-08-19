import { DEFAULT_LOCALE, type Locale } from "@/app/i18n/config";

/**
 * Store currency for the German shop.
 *
 * Stripe line items use the lowercase code; UI and emails use Intl to render
 * it in the reader's language.
 */

export const STORE_CURRENCY = "eur";
export const STORE_LOCALE = "de-DE";

/**
 * Number formatting per language.
 *
 * The currency never changes — every price is in euro, because every order
 * ships to Germany. What changes is how the amount is written: a German reader
 * expects "89,99 €" and an English one "€89.99". `en-IE` is used for English
 * rather than `en-US` because it is a euro locale, so the symbol lands in front
 * of the number without the "€" being treated as a foreign currency and
 * rendered as "EUR 89.99".
 */
const NUMBER_LOCALES: Record<Locale, string> = {
  de: STORE_LOCALE,
  en: "en-IE",
};

export function formatMoney(
  amount: number,
  currency: string = STORE_CURRENCY,
  locale: Locale = DEFAULT_LOCALE
): string {
  // Intl inserts a no-break space before €. A regular space is what the
  // copy reads as, and what queries for the rendered text can match.
  return new Intl.NumberFormat(NUMBER_LOCALES[locale] ?? STORE_LOCALE, {
    style: "currency",
    currency: currency.toUpperCase(),
  })
    .format(amount)
    .replace(/[\u00A0\u202F]/g, " ");
}
