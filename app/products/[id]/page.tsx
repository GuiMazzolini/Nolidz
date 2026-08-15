import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDB } from "@/app/api/db";
import { productGallery } from "@/app/lib/images";
import { getAvailableStock } from "@/app/lib/cart-limits";
import { products } from "@/app/lib/db-collections";
import { isSellableForPublic } from "@/app/lib/public-products";
import {
  serializeVariants,
  type ColorImage,
  type ProductVariant,
} from "@/app/lib/variants";
import ProductDetail from "./ProductDetail";

type Params = { id: string };

/** Live stock, same reasoning as the catalog page. */
export const dynamic = "force-dynamic";

type DBProduct = {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  stock: number;
  variants?: ProductVariant[];
  colorImages?: ColorImage[];
  images?: string[];
};

async function getProduct(id: string): Promise<DBProduct | null> {
  const { db } = await connectToDB();
  const product = await products(db).findOne({ id });
  // Sold-out pairs stay in admin only — shoppers get a 404, not an empty PDP.
  if (!product || !isSellableForPublic(product)) return null;

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    description: product.description,
    imageUrl: product.imageUrl,
    stock: getAvailableStock(product.stock),
    variants: serializeVariants(product.variants),
    colorImages: product.colorImages,
    images: product.images,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      // Every photo, main image first — a share card picks the first and a
      // crawler indexes the rest.
      images: productGallery(product),
    },
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  // `?color=` arrives from a catalog swatch, so the page opens on the
  // colourway the shopper was already looking at.
  searchParams: Promise<{ color?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const requested = Array.isArray(query.color) ? query.color[0] : query.color;

  return <ProductDetail product={product} initialColor={requested ?? null} />;
}
