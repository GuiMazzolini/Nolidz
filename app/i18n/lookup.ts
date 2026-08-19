import { DEFAULT_LOCALE, type Locale } from "./config";
import en, { type StorefrontDict } from "./dictionaries/storefront.en";
import de from "./dictionaries/storefront.de";
import adminEn, { type AdminDict } from "./dictionaries/admin.en";
import adminDe from "./dictionaries/admin.de";
import apiEn, { type ApiDict } from "./dictionaries/api.en";
import apiDe from "./dictionaries/api.de";
import emailEn, { type EmailDict } from "./dictionaries/email.en";
import emailDe from "./dictionaries/email.de";

/**
 * Dictionary lookup by locale, with no request context involved.
 *
 * Deliberately separate from `server.ts`: that module imports
 * `next/root-params`, which only works inside Server Components. The Stripe
 * webhook, the email senders and the Route Handlers all have a locale in hand
 * already — from the order record or the request cookie — and need the
 * dictionaries without dragging that constraint along.
 */

const STOREFRONT: Record<Locale, StorefrontDict> = { en, de };
const ADMIN: Record<Locale, AdminDict> = { en: adminEn, de: adminDe };
const API: Record<Locale, ApiDict> = { en: apiEn, de: apiDe };
const EMAIL: Record<Locale, EmailDict> = { en: emailEn, de: emailDe };

export function dictionaryFor(locale: Locale): StorefrontDict {
  return STOREFRONT[locale] ?? STOREFRONT[DEFAULT_LOCALE];
}

export function adminDictionaryFor(locale: Locale): AdminDict {
  return ADMIN[locale] ?? ADMIN[DEFAULT_LOCALE];
}

export function apiDictionaryFor(locale: Locale): ApiDict {
  return API[locale] ?? API[DEFAULT_LOCALE];
}

export function emailDictionaryFor(locale: Locale): EmailDict {
  return EMAIL[locale] ?? EMAIL[DEFAULT_LOCALE];
}

export type { StorefrontDict, AdminDict, ApiDict, EmailDict };
