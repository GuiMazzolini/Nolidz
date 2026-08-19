/**
 * The two languages the shop speaks.
 *
 * German leads because nolidz ships to Germany only (see SHIPPING_COUNTRIES):
 * a visitor with no usable `Accept-Language` is far likelier to want German
 * than English, and the checkout they are heading for is a German one.
 */
export const LOCALES = ["de", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** What each language calls itself, for the switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
};

/** The `lang`/`hreflang` attribute for a locale. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  de: "de-DE",
  en: "en",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Prefix an app-relative path with a locale: `/products` -> `/de/products`.
 *
 * Every route lives under `app/[lang]`, so an unprefixed href would 404 (or,
 * worse, bounce through the proxy and lose the query). Passing an
 * already-prefixed path through again is a no-op, which keeps this safe to
 * apply at the point of use without tracking whether a caller got there first.
 */
export function localePath(locale: Locale, path: string): string {
  if (!path.startsWith("/")) return path;

  const stripped = stripLocale(path);
  return stripped === "/" ? `/${locale}` : `/${locale}${stripped}`;
}

/**
 * Drop a leading locale segment, returning the path as the app knows it.
 * `/de/products` -> `/products`, `/de` -> `/`.
 */
export function stripLocale(path: string): string {
  for (const locale of LOCALES) {
    if (path === `/${locale}`) return "/";
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
}

/** The locale a pathname is under, or null when it carries no prefix. */
export function localeFromPath(path: string): Locale | null {
  const segment = path.split("/")[1];
  return isLocale(segment) ? segment : null;
}

/**
 * Pick a locale from an `Accept-Language` header.
 *
 * Hand-rolled rather than pulled from `@formatjs/intl-localematcher`: with two
 * languages the whole decision is "is German or English mentioned first", and
 * a dependency in the proxy would ship to the edge on every request.
 */
export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return {
        // Match on the primary subtag, so `de-AT` and `en-GB` both land.
        base: tag.trim().toLowerCase().split("-")[0],
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    // `q=0` explicitly rejects a language, so it must never win.
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (isLocale(entry.base)) return entry.base;
  }
  return DEFAULT_LOCALE;
}

/**
 * Cookie the proxy writes once a locale is resolved.
 *
 * Route Handlers cannot read root params (`next/root-params` is Server
 * Components only), so this is how `/api/*` learns which language to answer
 * an error in. It also remembers an explicit switch, so a returning visitor
 * who chose English is not sent back to German by their browser settings.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";
