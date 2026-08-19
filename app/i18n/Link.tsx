"use client";

import NextLink from "next/link";
import { forwardRef } from "react";
import { localePath } from "./config";
import { useLocale } from "./client";

type Props = React.ComponentProps<typeof NextLink>;

/**
 * `next/link` that keeps the reader in their language.
 *
 * Every route lives under `app/[lang]`, so a bare `/products` would 404 and a
 * proxy redirect back into a locale would drop the query string. Rather than
 * thread the locale into ~50 hrefs by hand, this reads it from context and
 * prefixes at render — call sites keep writing the path the app is organised
 * around. Absolute URLs and hashes pass through untouched.
 *
 * A Client Component, so Server Components can render it: only the href and
 * children cross the boundary, and both are already serialisable.
 */
const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, ...rest },
  ref
) {
  const locale = useLocale();

  const localized =
    typeof href === "string" && href.startsWith("/")
      ? localePath(locale, href)
      : href;

  return <NextLink ref={ref} href={localized} {...rest} />;
});

export default Link;
