import type { MetadataRoute } from "next";
import { connectToDB } from "@/app/api/db";
import { getAppUrl } from "@/app/lib/stripe";
import { products as productsCollection } from "@/app/lib/db-collections";
import { isSellableForPublic } from "@/app/lib/public-products";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_HTML_LANG,
  localePath,
} from "@/app/i18n/config";

/**
 * Every public route, once per language.
 *
 * Each entry carries `alternates.languages`, which is how the two copies of a
 * page are declared as translations of one another rather than as duplicate
 * content — without it, Google picks one and drops the other. The canonical
 * `url` is the default locale's, so that is the one that accrues ranking.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();

  const languagesFor = (path: string) =>
    Object.fromEntries(
      LOCALES.map((locale) => [
        LOCALE_HTML_LANG[locale],
        `${base}${localePath(locale, path)}`,
      ])
    );

  const entry = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number
  ): MetadataRoute.Sitemap[number] => ({
    url: `${base}${localePath(DEFAULT_LOCALE, path)}`,
    changeFrequency,
    priority,
    alternates: { languages: languagesFor(path) },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    entry("/", "weekly", 1),
    entry("/products", "daily", 0.9),
    entry("/cart", "weekly", 0.5),
    entry("/orders/lookup", "monthly", 0.4),
  ];

  try {
    const { db } = await connectToDB();
    const products = await productsCollection(db)
      .find({}, { projection: { id: 1, stock: 1, variants: 1 } })
      .toArray();

    const productRoutes: MetadataRoute.Sitemap = products
      .filter(isSellableForPublic)
      .map((doc) => entry(`/products/${doc.id}`, "weekly", 0.8));

    return [...staticRoutes, ...productRoutes];
  } catch {
    // Build/CI may not have a live DB — still publish core routes.
    return staticRoutes;
  }
}
