import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  isLocale,
  localeFromPath,
  matchLocale,
} from "@/app/i18n/config";

/** A year: the visitor's language is a preference, not a session detail. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Routes that live outside `app/[lang]` and must keep their bare URL.
 *
 * The statutory pages in `app/(legal)` are German-only by design — an
 * Impressum and a Widerrufsbelehrung are the German text of the offer, not
 * storefront copy to translate — so they sit at the app root. Sending them
 * through the locale redirect below points `/impressum` at `/de/impressum`,
 * which is a route that does not exist: the three pages a German shop is
 * legally required to keep reachable would all answer 404.
 */
const UNPREFIXED_PATHS = ["/impressum", "/datenschutz", "/widerruf"];

function isUnprefixed(pathname: string): boolean {
  return UNPREFIXED_PATHS.includes(pathname.replace(/\/+$/, "") || "/");
}

/**
 * Puts every request on a locale-prefixed URL, and remembers which one.
 *
 * Two jobs, in this order:
 *
 * 1. A URL that already names a locale is authoritative. Someone following
 *    `/en/products` from a shared link gets English even if their browser asks
 *    for German, and the cookie is updated so the rest of the visit — including
 *    `/api/*`, which cannot read root params — follows them.
 * 2. A URL without one is resolved from the cookie first and `Accept-Language`
 *    second, then redirected. The cookie takes precedence so an explicit switch
 *    survives a later visit to a bare `/`.
 *
 * The legal pages are exempt from both, and pass through untouched.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isUnprefixed(pathname)) return NextResponse.next();

  const pathLocale = localeFromPath(pathname);

  if (pathLocale) {
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== pathLocale) {
      response.cookies.set(LOCALE_COOKIE, pathLocale, {
        path: "/",
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
      });
    }
    return response;
  }

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved)
    ? saved
    : matchLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
  url.search = search;

  // 307, not 308: the language a bare URL resolves to depends on the visitor,
  // so it must not be cached as a permanent property of that URL.
  const response = NextResponse.redirect(url, 307);
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  /**
   * Everything except the paths that must keep their exact URL: API routes,
   * Next's own assets, the metadata routes, and anything in `public/` (matched
   * by the dot, which no page route has).
   */
  matcher: [
    "/((?!api/|_next/|robots\\.txt|sitemap\\.xml|.*\\.[^/]+$).*)",
  ],
};
