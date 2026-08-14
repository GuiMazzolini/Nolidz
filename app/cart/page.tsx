import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { connectToDB } from "@/app/api/db";
import { carts, products } from "@/app/lib/db-collections";
import { findVariant, hasVariants, resolveLineStock } from "@/app/lib/variants";
import ShoppingCartList from "./ShoppingCartList";
import type { Product } from "@/app/product-data";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review the items in your cart before checking out.",
};

type CartItem = { productId: string; quantity: number; variantSku?: string };

export default async function CartPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return <ShoppingCartList initialCartProducts={[]} />;
  }

  const { db } = await connectToDB();

  const cart = await carts(db).findOne({ userId: session.user.email });
  const items: CartItem[] = cart?.items || [];

  let cartProducts: Product[] = [];

  if (items.length > 0) {
    const productIds = items.map((i) => i.productId);
    const productDocs = await products(db)
      .find({ id: { $in: productIds } })
      .toArray();

    cartProducts = items
      .map((item) => {
        const product = productDocs.find((p) => p.id === item.productId);
        if (!product) return null;
        const variant = findVariant(product.variants, item.variantSku);
        if (hasVariants(product) && !variant) return null;

        return {
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          imageUrl: product.imageUrl,
          stock: resolveLineStock(product, item.variantSku),
          quantity: item.quantity,
          ...(variant
            ? {
                variantSku: variant.sku,
                variantSize: variant.size,
                variantColor: variant.color,
              }
            : {}),
        };
      })
      .filter(Boolean) as Product[];
  }

  return <ShoppingCartList initialCartProducts={cartProducts} />;
}
