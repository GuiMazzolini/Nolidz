import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { connectToDB } from "@/app/api/db";
import { carts } from "@/app/lib/db-collections";
import { loadCartProducts } from "@/app/lib/cart-server";
import ShippingAreaBanner from "@/app/components/ShippingAreaBanner";
import ShoppingCartList from "./ShoppingCartList";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review the items in your cart before checking out.",
};

export default async function CartPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return (
      <>
        <ShippingAreaBanner />
        <ShoppingCartList initialCartProducts={[]} />
      </>
    );
  }

  const { db } = await connectToDB();

  const cart = await carts(db).findOne({ userId: session.user.email });
  const items = cart?.items || [];

  const cartProducts = await loadCartProducts(db, items);

  return (
    <>
      <ShippingAreaBanner />
      <ShoppingCartList initialCartProducts={cartProducts} />
    </>
  );
}
