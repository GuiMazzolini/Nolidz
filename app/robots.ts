import type { MetadataRoute } from "next";
import { getAppUrl } from "@/app/lib/stripe";
import { LOCALES } from "@/app/i18n/config";

export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();

  /** The private areas, once per language, since every route is prefixed now. */
  const perLocale = (path: string) =>
    LOCALES.map((locale) => `/${locale}${path}`);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        ...perLocale("/admin/"),
        ...perLocale("/checkout/success"),
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
