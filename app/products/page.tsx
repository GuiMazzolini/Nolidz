import type { Metadata } from "next";
import { connectToDB } from "@/app/api/db";
import ProductsList from "../components/ProductsList";
import { parseCategoryFilter } from "@/app/lib/categories";
import { getAvailableStock } from "@/app/lib/cart-limits";
import { products as productsCollection } from "@/app/lib/db-collections";
import { isSellableForPublic } from "@/app/lib/public-products";
import { serializeVariants } from "@/app/lib/variants";
import type { Product } from "@/app/product-data";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse outlet sneaker finds from nolidz — unboxed, photographed, and ready to wear.",
};

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
  const products = await productsCollection(db).find({}).toArray();

  const serialized: Product[] = products
    .filter(isSellableForPublic)
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      price: doc.price,
      description: doc.description,
      imageUrl: doc.imageUrl,
      stock: getAvailableStock(doc.stock),
      category: doc.category,
      variants: serializeVariants(doc.variants),
      colorImages: doc.colorImages,
      images: doc.images,
    }));

  return (
    <ProductsList
      key={initialCategory}
      products={serialized}
      initialCategory={initialCategory}
    />
  );
}
