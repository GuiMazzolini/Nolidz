"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LOCALES,
  LOCALE_HTML_LANG,
  LOCALE_LABELS,
  stripLocale,
} from "@/app/i18n/config";
import { useLocale, useT } from "@/app/i18n/client";

/**
 * DE / EN switch.
 *
 * Swaps only the locale segment and keeps the reader where they were, query
 * string included — someone reading `/de/products?category=women` who switches
 * to English lands on the English women's page, not back at a generic home.
 *
 * The query is read at click time from `window.location` rather than through
 * `useSearchParams`. That hook opts the surrounding boundary out of
 * server rendering, and the switch would then be missing from the HTML
 * entirely: absent on first paint, and invisible to a crawler deciding whether
 * this page has a translation. Reading on click keeps the rendered `href` a
 * real, server-rendered URL and still carries the filters across. It is also
 * always current, which a value captured at render time would not be — the
 * category filter rewrites the query with `router.replace`, without changing
 * the pathname this component re-renders on.
 *
 * `prefetch={false}`: the other language is a deliberate choice, not somewhere
 * most visitors are heading, and prefetching would pull a second copy of every
 * page they hover.
 */
export default function LanguageToggle() {
  const active = useLocale();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();

  const rest = stripLocale(pathname);

  return (
    <div
      className="flex items-center border border-ink/15"
      role="group"
      aria-label={t.nav.language}
    >
      {LOCALES.map((locale) => {
        const current = locale === active;
        const target = rest === "/" ? `/${locale}` : `/${locale}${rest}`;

        return (
          <Link
            key={locale}
            href={target}
            hrefLang={LOCALE_HTML_LANG[locale]}
            prefetch={false}
            aria-current={current ? "true" : undefined}
            aria-label={
              locale === "de" ? t.nav.switchToGerman : t.nav.switchToEnglish
            }
            title={LOCALE_LABELS[locale]}
            onClick={(event) => {
              // Without JS the plain href above still works; this only adds the
              // filters back on.
              const search = window.location.search;
              if (!search || current) return;
              event.preventDefault();
              router.push(`${target}${search}`);
            }}
            className={`px-2 py-1 text-xs font-semibold uppercase transition-colors ${
              current
                ? "bg-ink text-paper"
                : "text-ink/70 hover:text-ink hover:bg-ink/5"
            }`}
          >
            {locale}
          </Link>
        );
      })}
    </div>
  );
}
