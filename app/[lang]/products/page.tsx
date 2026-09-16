import type { Metadata } from "next";
import { connectToDB } from "@/app/api/db";
import ProductsList from "@/app/components/ProductsList";
import ShippingAreaBanner from "@/app/components/ShippingAreaBanner";
import { parseCategoryFilter } from "@/app/lib/categories";
import { getAvailableStock } from "@/app/lib/cart-limits";
import { products as productsCollection } from "@/app/lib/db-collections";
import {
  localizeProductsContent,
  withLocalizedContent,
} from "@/app/lib/product-content";
import { isSellableForPublic } from "@/app/lib/public-products";
import { sweepExpiredHoldsBestEffort } from "@/app/lib/stock-hold";
import { normalizeColorImages, serializeVariants } from "@/app/lib/variants";
import type { Product } from "@/app/product-data";
import { getLocale, getT } from "@/app/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t.catalog.metaTitle,
    description: t.catalog.metaDescription,
  };
}

/**
 * Rendered per request: the catalog carries live stock counts, and a build-time
 * snapshot would show sold-out items as available until the next deploy.
 * It also keeps the build from requiring a reachable database.
 */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ category?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const { category: rawCategory } = await searchParams;
  const initialCategory = parseCategoryFilter(rawCategory);

  const { db } = await connectToDB();
  // Abandoned checkouts hold stock for ~35 minutes. Without a sweep here, a
  // missed Stripe webhook leaves the last unit invisible on the shop until
  // someone else starts checkout — which can be days on a quiet store.
  await sweepExpiredHoldsBestEffort(db);

  const locale = await getLocale();
  const docs = await productsCollection(db).find({}).toArray();
  const sellable = docs.filter(isSellableForPublic);
  const localized = await localizeProductsContent(db, sellable, locale);

  const serialized: Product[] = sellable.map((doc) => {
    const base: Product = {
      id: doc.id,
      name: doc.name,
      price: doc.price,
      description: doc.description,
      imageUrl: doc.imageUrl,
      stock: getAvailableStock(doc.stock),
      category: doc.category,
      variants: serializeVariants(doc.variants),
      colorImages: normalizeColorImages(doc.colorImages),
      images: doc.images,
    };
    return withLocalizedContent(
      base,
      localized.get(doc.id) ?? {
        description: doc.description,
        colorLabels: {},
      }
    );
  });

  return (
    <>
      <ShippingAreaBanner />
      <ProductsList
        key={initialCategory}
        products={serialized}
        initialCategory={initialCategory}
      />
    </>
  );
}
