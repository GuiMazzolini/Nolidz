"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, localePath, type Locale } from "./config";
import en, { type StorefrontDict } from "./dictionaries/storefront.en";
import de from "./dictionaries/storefront.de";
import adminEn, { type AdminDict } from "./dictionaries/admin.en";
import adminDe from "./dictionaries/admin.de";

/**
 * Both dictionaries are imported here rather than handed down from the server.
 *
 * Only the locale string crosses the RSC boundary, so switching pages does not
 * re-serialise several kilobytes of copy into every flight payload; the strings
 * ride along in a JS chunk the browser caches once. It also means the dictionary
 * can hold functions, which is what lets German inflect around inserted values
 * instead of being bent into English word order.
 */
const DICTIONARIES: Record<Locale, StorefrontDict> = { en, de };

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The active dictionary. Named `t` at call sites: `const t = useT()`. */
export function useT(): StorefrontDict {
  return DICTIONARIES[useLocale()];
}

/**
 * Admin copy, in its own dictionary and its own hook.
 *
 * Importing it only from the admin client components keeps it in their chunk,
 * so a shopper never downloads the fulfillment vocabulary in either language.
 */
const ADMIN_DICTIONARIES: Record<Locale, AdminDict> = {
  en: adminEn,
  de: adminDe,
};

export function useAdminT(): AdminDict {
  return ADMIN_DICTIONARIES[useLocale()];
}

/**
 * Prefix an app path with the active locale.
 *
 * For `router.push`/`replace` and `callbackUrl`, where a component needs the
 * string itself rather than a link.
 */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale();
  return useMemo(() => (path: string) => localePath(locale, path), [locale]);
}
