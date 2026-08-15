import type { Metadata } from "next";
import ProductForm from "../ProductForm";

export const metadata: Metadata = {
  title: "Admin — New product",
  robots: { index: false, follow: false },
};

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="font-display italic font-extrabold text-3xl text-ink tracking-tight mb-6 text-center">
        Add product
      </h2>
      <ProductForm mode="create" />
    </div>
  );
}
