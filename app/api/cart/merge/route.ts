import { connectToDB } from "@/app/api/db";
import { authOptions } from "@/app/lib/auth";
import { clampCartQuantity } from "@/app/lib/cart-limits";
import {
  carts,
  products,
  type CartItemDoc,
  type ProductDoc,
} from "@/app/lib/db-collections";
import {
  cartLineKey,
  findVariant,
  hasVariants,
  resolveLinePrice,
  resolveLineStock,
} from "@/app/lib/variants";
import { parseBody } from "@/app/lib/api-request";
import { cartMergeSchema } from "@/app/lib/schemas";
import { enforceRateLimit, RATE_LIMITS } from "@/app/lib/rate-limit";
import type { Db } from "mongodb";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

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
      const variant = findVariant(product.variants, item.variantSku);
      if (hasVariants(product) && !variant) return null;

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
    })
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(
    req,
    "cart-merge",
    RATE_LIMITS.cartMerge.limit,
    RATE_LIMITS.cartMerge.windowSec
  );
  if (limited) return limited;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, cartMergeSchema);
  if (!parsed.ok) return parsed.response;
  const incoming = parsed.data.items;

  const { db } = await connectToDB();
  const userId = session.user.email;

  const cart = await carts(db).findOne({ userId });
  const existing: CartItemDoc[] = cart?.items || [];

  // Keyed per size/colour: the same shoe in EU 42 and EU 43 must stay two
  // lines through the merge instead of collapsing into one.
  const lines = new Map<
    string,
    { productId: string; variantSku?: string; quantity: number }
  >();

  function addLine(item: CartItemDoc, quantity: number) {
    const key = cartLineKey(item.productId, item.variantSku);
    const existingLine = lines.get(key);
    if (existingLine) {
      existingLine.quantity += quantity;
      return;
    }
    lines.set(key, {
      productId: item.productId,
      variantSku: item.variantSku,
      quantity,
    });
  }

  for (const item of existing) {
    if (item?.productId) addLine(item, item.quantity || 0);
  }
  for (const item of incoming) {
    addLine(item, item.quantity);
  }

  const productIds = [...new Set([...lines.values()].map((l) => l.productId))];
  const productDocs = await products(db)
    .find({ id: { $in: productIds } })
    .toArray();
  const productsById = new Map<string, ProductDoc>(
    productDocs.map((p) => [p.id, p])
  );

  const mergedItems: CartItemDoc[] = [];
  for (const line of lines.values()) {
    const product = productsById.get(line.productId);
    if (!product) continue;
    // Drops lines pointing at a variant that no longer exists, and lines with
    // no variant on a product that now sells only by size.
    if (hasVariants(product) && !findVariant(product.variants, line.variantSku)) {
      continue;
    }

    const stock = resolveLineStock(product, line.variantSku);
    const quantity = clampCartQuantity(line.quantity, stock);
    if (quantity >= 1) {
      mergedItems.push({
        productId: line.productId,
        quantity,
        ...(line.variantSku ? { variantSku: line.variantSku } : {}),
      });
    }
  }

  await carts(db).updateOne(
    { userId },
    {
      $set: { items: mergedItems, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  const cartProducts = await buildCartProducts(db, mergedItems);
  return NextResponse.json(cartProducts);
}
