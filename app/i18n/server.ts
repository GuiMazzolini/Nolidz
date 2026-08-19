import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "./config";
import {
  adminDictionaryFor,
  dictionaryFor,
  type AdminDict,
  type StorefrontDict,
} from "./lookup";

export { dictionaryFor };

/**
 * The locale of the current request, for Server Components and the utilities
 * they call.
 *
 * Read from the root param rather than passed down: `lang` sits above the root
 * layout, so metadata generators and helpers several levels deep can ask for it
 * without every page in between accepting a prop it does not use.
 *
 * Not available in Route Handlers or Server Actions — those read the locale
 * cookie instead, via `localeFromRequest` in ./request.
 */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  // An unknown prefix is a URL that does not exist, not a reason to silently
  // serve German: 404 keeps `/fr/products` out of the index.
  if (!isLocale(value)) notFound();
  return value;
}

export async function getT(): Promise<StorefrontDict> {
  return dictionaryFor(await getLocale());
}

/** Locale, dictionary, and a locale-aware path builder — the common trio. */
export async function getI18n(): Promise<{
  locale: Locale;
  t: StorefrontDict;
  path: (path: string) => string;
}> {
  const locale = await getLocale();
  return {
    locale,
    t: dictionaryFor(locale),
    path: (p: string) => localePath(locale, p),
  };
}

/** The same, with the admin dictionary, for the /admin Server Components. */
export async function getAdminI18n(): Promise<{
  locale: Locale;
  t: AdminDict;
  path: (path: string) => string;
}> {
  const locale = await getLocale();
  return {
    locale,
    t: adminDictionaryFor(locale),
    path: (p: string) => localePath(locale, p),
  };
}
