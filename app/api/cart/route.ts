import { connectToDB } from "@/app/api/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { MAX_CART_QUANTITY } from "@/app/lib/cart-limits";
import { carts, products, type CartItemDoc, type ProductDoc } from "@/app/lib/db-collections";
import { parseBody, unauthorized } from "@/app/lib/api-request";
import {
  cartDeleteSchema,
  cartPatchSchema,
  cartPostSchema,
} from "@/app/lib/schemas";
import { findVariant, hasVariants, resolveLinePrice, resolveLineStock } from "@/app/lib/variants";
import type { Db, Filter } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

/** The cart is keyed by email, so a session without one cannot own a cart. */
async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? null;
}

/**
 * Criteria identifying one cart line. A line for a single-SKU product must
 * match only lines that carry no SKU, or removing "the shoe" would remove
 * whichever size Mongo happened to store first.
 */
function cartItemMatch(productId: string, variantSku?: string) {
  // Operator form throughout: the driver's $pull typing rejects a shape that
  // mixes a bare value with an operator object.
  return {
    productId: { $eq: productId },
    variantSku: variantSku ? { $eq: variantSku } : { $exists: false },
  };
}

function itemFilter(userId: string, productId: string, variantSku?: string) {
  return {
    userId,
    items: { $elemMatch: cartItemMatch(productId, variantSku) },
  } as Filter<{ userId: string; items: CartItemDoc[] }>;
}

function findCartItem(
  items: CartItemDoc[],
  productId: string,
  variantSku?: string
): CartItemDoc | undefined {
  return items.find(
    (i) => i.productId === productId && (i.variantSku ?? undefined) === variantSku
  );
}

function serializeCartProduct(
  product: ProductDoc,
  item: CartItemDoc
) {
  const variant = findVariant(product.variants, item.variantSku);
  return {
    id: product.id,
    name: product.name,
    price: resolveLinePrice(product, item.variantSku),
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
}

async function buildCartProducts(db: Db, items: CartItemDoc[]) {
  if (!items.length) return [];
  const productIds = items.map((i) => i.productId);
  const productDocs = await products(db)
    .find({ id: { $in: productIds } })
    .toArray();

  return items
    .map((item) => {
      const product = productDocs.find((p) => p.id === item.productId);
      if (!product) return null;
      // A line whose variant was deleted from the catalog can no longer be
      // priced or shipped, so it drops out of the cart instead of showing.
      if (hasVariants(product) && !findVariant(product.variants, item.variantSku)) {
        return null;
      }
      return serializeCartProduct(product, item);
    })
    .filter(Boolean);
}

/** Resolve the product and the stock backing this line, or an error response. */
async function resolveLine(db: Db, productId: string, variantSku?: string) {
  const product = await products(db).findOne({ id: productId });
  if (!product) {
    return {
      error: NextResponse.json({ error: "Product not found" }, { status: 404 }),
    };
  }

  if (hasVariants(product) && !findVariant(product.variants, variantSku)) {
    return {
      error: NextResponse.json(
        { error: "Choose a size and colour" },
        { status: 400 }
      ),
    };
  }

  return { product, stock: resolveLineStock(product, variantSku) };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { db } = await connectToDB();
  const cart = await carts(db).findOne({ userId });
  const cartProducts = await buildCartProducts(db, cart?.items || []);

  return NextResponse.json(cartProducts);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = await parseBody(req, cartPostSchema);
  if (!parsed.ok) return parsed.response;
  const { productId, variantSku } = parsed.data;

  const { db } = await connectToDB();

  const line = await resolveLine(db, productId, variantSku);
  if (line.error) return line.error;

  const { stock } = line;
  if (stock < 1) {
    return NextResponse.json({ error: "Out of stock" }, { status: 409 });
  }

  const cart = await carts(db).findOne({ userId });
  const existingItem = findCartItem(cart?.items || [], productId, variantSku);

  let updatedCart;
  if (existingItem) {
    if (existingItem.quantity >= stock) {
      return NextResponse.json(
        { error: `Only ${stock} in stock` },
        { status: 409 }
      );
    }
    const nextQuantity = Math.min(existingItem.quantity + 1, MAX_CART_QUANTITY, stock);
    updatedCart = await carts(db).findOneAndUpdate(
      itemFilter(userId, productId, variantSku),
      { $set: { "items.$.quantity": nextQuantity, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
  } else {
    updatedCart = await carts(db).findOneAndUpdate(
      { userId },
      {
        $push: {
          items: { productId, quantity: 1, ...(variantSku ? { variantSku } : {}) },
        },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: "after" }
    );
  }

  const cartProducts = await buildCartProducts(db, updatedCart?.items || []);
  return NextResponse.json(cartProducts, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = await parseBody(req, cartPatchSchema);
  if (!parsed.ok) return parsed.response;
  const { productId, quantity, variantSku } = parsed.data;

  const { db } = await connectToDB();

  let updatedCart;
  if (quantity === 0) {
    updatedCart = await carts(db).findOneAndUpdate(
      { userId },
      {
        $pull: { items: cartItemMatch(productId, variantSku) },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" }
    );
    if (!updatedCart)
      return NextResponse.json({ error: "Item not found in cart" }, { status: 404 });
  } else {
    const line = await resolveLine(db, productId, variantSku);
    if (line.error) return line.error;

    const { stock } = line;
    if (stock < 1) {
      return NextResponse.json({ error: "Out of stock" }, { status: 409 });
    }
    if (quantity > stock) {
      return NextResponse.json(
        { error: `Only ${stock} in stock` },
        { status: 409 }
      );
    }

    updatedCart = await carts(db).findOneAndUpdate(
      itemFilter(userId, productId, variantSku),
      { $set: { "items.$.quantity": quantity, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!updatedCart)
      return NextResponse.json({ error: "Item not found in cart" }, { status: 404 });
  }

  const cartProducts = await buildCartProducts(db, updatedCart?.items || []);
  return NextResponse.json(cartProducts);
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const parsed = await parseBody(req, cartDeleteSchema);
  if (!parsed.ok) return parsed.response;
  const { productId, variantSku } = parsed.data;

  const { db } = await connectToDB();

  const updatedCart = await carts(db).findOneAndUpdate(
    { userId },
    {
      $pull: { items: cartItemMatch(productId, variantSku) },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );

  const cartProducts = await buildCartProducts(db, updatedCart?.items || []);
  return NextResponse.json(cartProducts);
}
