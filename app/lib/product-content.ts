import { createHash } from "crypto";
import type { Db } from "mongodb";
import type { Locale } from "@/app/i18n/config";
import {
  products,
  type ProductDoc,
  type ProductLocaleTranslation,
} from "@/app/lib/db-collections";
import { isDeepLConfigured, translateTexts } from "@/app/lib/deepl";
import { listColors } from "@/app/lib/variants";

export type TranslateFn = (
  texts: string[],
  targetLang?: "DE"
) => Promise<string[]>;

export type LocalizedProductContent = {
  /** Description in the request locale (English when locale is en). */
  description: string;
  /**
   * Canonical English colour → label for display. Empty when locale is en or
   * there are no colours. Selection / URLs keep using the English keys.
   */
  colorLabels: Record<string, string>;
};

type ContentSource = Pick<
  ProductDoc,
  "id" | "description" | "variants" | "translations"
>;

/** Stable fingerprint of the English fields DeepL is asked to translate. */
export function productContentHash(
  description: string,
  colors: string[]
): string {
  const normalizedColors = [...colors]
    .map((c) => c.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return createHash("sha256")
    .update(JSON.stringify({ description, colors: normalizedColors }))
    .digest("hex");
}

function identityLabels(colors: string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const color of colors) labels[color] = color;
  return labels;
}

function englishContent(source: ContentSource): LocalizedProductContent {
  const colors = listColors(source.variants ?? []);
  return {
    description: source.description,
    colorLabels: identityLabels(colors),
  };
}

function fromCache(
  cached: ProductLocaleTranslation,
  colors: string[]
): LocalizedProductContent {
  const colorLabels: Record<string, string> = {};
  for (const color of colors) {
    colorLabels[color] = cached.colors[color] ?? color;
  }
  return {
    description: cached.description,
    colorLabels,
  };
}

async function writeDeCache(
  db: Db,
  productId: string,
  translation: ProductLocaleTranslation
): Promise<void> {
  await products(db).updateOne(
    { id: productId },
    { $set: { "translations.de": translation } }
  );
}

/**
 * Localize one product's shopper-facing copy for the current locale.
 *
 * English is the stored source of truth. German is served from a per-product
 * cache, filled via DeepL on a miss. Failures and a missing API key fall back
 * to English without poisoning the cache.
 */
export async function localizeProductContent(
  db: Db,
  source: ContentSource,
  locale: Locale,
  translate: TranslateFn = translateTexts
): Promise<LocalizedProductContent> {
  if (locale !== "de") return englishContent(source);

  const colors = listColors(source.variants ?? []);
  const hash = productContentHash(source.description, colors);
  const cached = source.translations?.de;
  if (cached && cached.sourceHash === hash) {
    return fromCache(cached, colors);
  }

  if (!isDeepLConfigured()) {
    return englishContent(source);
  }

  try {
    const texts = [source.description, ...colors];
    const translated = await translate(texts, "DE");
    const description = translated[0] ?? source.description;
    const colorLabels: Record<string, string> = {};
    for (let i = 0; i < colors.length; i++) {
      colorLabels[colors[i]] = translated[i + 1] ?? colors[i];
    }

    const translation: ProductLocaleTranslation = {
      description,
      colors: colorLabels,
      sourceHash: hash,
    };
    await writeDeCache(db, source.id, translation);
    return { description, colorLabels };
  } catch (err) {
    console.error("[deepl] product localization failed", source.id, err);
    return englishContent(source);
  }
}

/**
 * Localize many products, batching DeepL into one request for cache misses.
 */
export async function localizeProductsContent(
  db: Db,
  sources: ContentSource[],
  locale: Locale,
  translate: TranslateFn = translateTexts
): Promise<Map<string, LocalizedProductContent>> {
  const out = new Map<string, LocalizedProductContent>();
  if (locale !== "de") {
    for (const source of sources) {
      out.set(source.id, englishContent(source));
    }
    return out;
  }

  const misses: Array<{
    source: ContentSource;
    colors: string[];
    hash: string;
  }> = [];

  for (const source of sources) {
    const colors = listColors(source.variants ?? []);
    const hash = productContentHash(source.description, colors);
    const cached = source.translations?.de;
    if (cached && cached.sourceHash === hash) {
      out.set(source.id, fromCache(cached, colors));
    } else {
      misses.push({ source, colors, hash });
    }
  }

  if (misses.length === 0) return out;

  if (!isDeepLConfigured()) {
    for (const { source } of misses) {
      out.set(source.id, englishContent(source));
    }
    return out;
  }

  // One flat batch: each miss contributes [description, ...colors].
  const batch: string[] = [];
  const spans: number[] = [];
  for (const miss of misses) {
    spans.push(batch.length);
    batch.push(miss.source.description);
    batch.push(...miss.colors);
  }

  try {
    const translated = await translate(batch, "DE");

    await Promise.all(
      misses.map(async (miss, index) => {
        const start = spans[index];
        const description = translated[start] ?? miss.source.description;
        const colorLabels: Record<string, string> = {};
        for (let i = 0; i < miss.colors.length; i++) {
          colorLabels[miss.colors[i]] =
            translated[start + 1 + i] ?? miss.colors[i];
        }
        const translation: ProductLocaleTranslation = {
          description,
          colors: colorLabels,
          sourceHash: miss.hash,
        };
        await writeDeCache(db, miss.source.id, translation);
        out.set(miss.source.id, { description, colorLabels });
      })
    );
  } catch (err) {
    console.error("[deepl] batch product localization failed", err);
    for (const { source } of misses) {
      if (!out.has(source.id)) out.set(source.id, englishContent(source));
    }
  }

  return out;
}

/** Apply localized fields onto a public Product-shaped object. */
export function withLocalizedContent<T extends { description: string }>(
  product: T,
  localized: LocalizedProductContent
): T & { description: string; colorLabels: Record<string, string> } {
  return {
    ...product,
    description: localized.description,
    colorLabels: localized.colorLabels,
  };
}
