import type { Metadata } from "next";
import ProductForm from "../ProductForm";
import { getAdminI18n } from "@/app/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminI18n();
  return {
    title: t.products.metaTitleNew,
    robots: { index: false, follow: false },
  };
}

export default async function NewProductPage() {
  const { t } = await getAdminI18n();

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="font-display italic font-extrabold text-3xl text-ink tracking-tight mb-6 text-center">
        {t.products.addHeading}
      </h2>
      <ProductForm mode="create" />
    </div>
  );
}
