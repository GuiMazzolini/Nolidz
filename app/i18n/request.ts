import {
  LOCALE_COOKIE,
  isLocale,
  matchLocale,
  type Locale,
} from "./config";

/**
 * The locale for a Route Handler.
 *
 * `next/root-params` is Server Components only, so `/api/*` cannot read the
 * `[lang]` segment — and it has none anyway, since the API is not localised in
 * its URLs. The cookie the proxy writes on every page view is the link: by the
 * time a browser posts to `/api/cart`, it has already been served a page in a
 * language and is carrying the cookie that says which.
 *
 * `Accept-Language` is the fallback for the first request of a session, and a
 * direct API call with neither gets the default. No error message is worth
 * failing a request over, so this never throws.
 */
export function localeFromRequest(req: Request): Locale {
  const cookie = readCookie(req.headers.get("cookie"), LOCALE_COOKIE);
  if (isLocale(cookie)) return cookie;
  return matchLocale(req.headers.get("accept-language"));
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}
