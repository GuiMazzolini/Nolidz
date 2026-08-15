/**
 * Store currency for the German shop.
 *
 * Stripe line items use the lowercase code; UI and emails use Intl with de-DE
 * so amounts read as "89,99 €".
 */

export const STORE_CURRENCY = "eur";
export const STORE_LOCALE = "de-DE";

export function formatMoney(
  amount: number,
  currency: string = STORE_CURRENCY
): string {
  // Intl inserts a no-break space before €. A regular space is what the
  // copy reads as, and what queries for the rendered text can match.
  return new Intl.NumberFormat(STORE_LOCALE, {
    style: "currency",
    currency: currency.toUpperCase(),
  })
    .format(amount)
    .replace(/[\u00A0\u202F]/g, " ");
}
