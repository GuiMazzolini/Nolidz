import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDB } from "@/app/api/db";
import { getAvailableStock } from "@/app/lib/cart-limits";
import { products } from "@/app/lib/db-collections";
import { serializeVariants } from "@/app/lib/variants";
import ProductForm from "../../ProductForm";
import { getAdminI18n } from "@/app/i18n/server";

type Params = { id: string };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminI18n();
  return {
    title: t.products.metaTitleEdit,
    robots: { index: false, follow: false },
  };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { t } = await getAdminI18n();
  const { id } = await params;
  const { db } = await connectToDB();
  const product = await products(db).findOne({ id });
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="font-display italic font-extrabold text-3xl text-ink tracking-tight mb-6 text-center">
        {t.products.editHeading(product.name)}
      </h2>
      <ProductForm
        mode="edit"
        initial={{
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          price: product.price,
          stock: getAvailableStock(product.stock),
          variants: serializeVariants(product.variants),
          colorImages: product.colorImages,
          images: product.images,
          category: product.category,
        }}
      />
    </div>
  );
}
