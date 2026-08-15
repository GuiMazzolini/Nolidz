import type { Metadata } from "next";
import { connectToDB } from "@/app/api/db";
import { serializeAdminProduct } from "@/app/lib/admin-products";
import { products as productsCollection } from "@/app/lib/db-collections";
import { heldStockFor } from "@/app/lib/stock-hold";
import AdminProductsTable from "./AdminProductsTable";

export const metadata: Metadata = {
  title: "Admin — Products",
  robots: { index: false, follow: false },
};

export default async function AdminProductsPage() {
  const { db } = await connectToDB();
  const docs = await productsCollection(db).find({}).sort({ name: 1 }).toArray();
  // Shelf stock, matching the edit form. Showing available here and shelf
  // there would have the same product reporting two different numbers.
  const held = await heldStockFor(db, docs.map((doc) => doc.id));
  const products = docs.map((doc) =>
    serializeAdminProduct(doc, held.get(doc.id))
  );

  return (
    <div>
      <p className="text-cardboard-dark font-display font-semibold uppercase tracking-[0.28em] text-sm mb-2">
        Catalog
      </p>
      <h2 className="font-display italic font-extrabold text-3xl text-ink tracking-tight mb-2">
        Products
      </h2>
      <p className="mb-6 text-ink/60">
        Manage catalog inventory, pricing, and product images.
      </p>
      <AdminProductsTable products={products} />
    </div>
  );
}
