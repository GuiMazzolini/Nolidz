import { connectToDB } from "@/app/api/db";
import { normalizeProductImageUrl } from "@/app/lib/admin";
import { serializeAdminProduct } from "@/app/lib/admin-products";
import { adminUnauthorized, requireAdmin } from "@/app/lib/admin-auth";
import { products, type ProductDoc } from "@/app/lib/db-collections";
import { badRequest, parseBody } from "@/app/lib/api-request";
import { isDuplicateKeyError } from "@/app/lib/mongo-errors";
import { adminProductUpdateSchema, resolveVariants } from "@/app/lib/schemas";
import { heldStockFor } from "@/app/lib/stock-hold";
import {
  hasVariants,
  totalVariantStock,
  type ColorImage,
} from "@/app/lib/variants";
import { NextRequest, NextResponse } from "next/server";

type Params = { id: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireAdmin();
  if (!session) {
    return adminUnauthorized();
  }

  const { id } = await params;
  const { db } = await connectToDB();
  const product = await products(db).findOne({ id });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const held = await heldStockFor(db, [id]);
  return NextResponse.json(serializeAdminProduct(product, held.get(id)));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireAdmin();
  if (!session) {
    return adminUnauthorized();
  }

  const { id } = await params;
  const parsed = await parseBody(req, adminProductUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const updates: Partial<ProductDoc> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  const { name, description, imageUrl, price, stock, category, variants, colorImages, images } =
    parsed.data;
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = price;
  if (category !== undefined) updates.category = category;
  if (imageUrl !== undefined) {
    try {
      updates.imageUrl = normalizeProductImageUrl(imageUrl);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Invalid image URL");
    }
  }

  if (colorImages?.length) {
    try {
      updates.colorImages = colorImages.map((entry) => ({
        color: entry.color,
        imageUrl: normalizeProductImageUrl(entry.imageUrl),
      })) satisfies ColorImage[];
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Invalid image URL");
    }
  }
  const clearColorImages = colorImages !== undefined && colorImages.length === 0;

  if (images?.length) {
    try {
      updates.images = images.map((url) => normalizeProductImageUrl(url));
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Invalid image URL");
    }
  }
  const clearImages = images !== undefined && images.length === 0;

  const { db } = await connectToDB();
  const current = await products(db).findOne({ id });
  if (!current) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // An empty array clears the variants; omitting the field leaves them alone.
  const clearVariants = variants !== undefined && variants.length === 0;
  const nextVariants =
    variants && variants.length > 0 ? resolveVariants(id, variants) : null;

  /**
   * The form shows shelf stock, so the submitted numbers include units that
   * checkouts in progress have already taken. Subtracting them back out is
   * what keeps a released hold from adding its units on top of the new count.
   * The result may go negative if the admin writes down fewer than are held —
   * that is a genuine oversell, and leaving it negative stops further sales
   * until the count recovers rather than hiding it.
   */
  const held = (await heldStockFor(db, [id])).get(id);
  const available = (shelf: number, sku?: string) =>
    shelf - (sku ? (held?.bySku.get(sku) ?? 0) : (held?.total ?? 0));

  if (nextVariants) {
    const adjusted = nextVariants.map((variant) => ({
      ...variant,
      stock: available(variant.stock, variant.sku),
    }));
    updates.variants = adjusted;
    // Derived, never taken from the body: the two must not disagree.
    updates.stock = totalVariantStock(adjusted);
  } else if (clearVariants) {
    updates.stock = available(stock ?? 0);
  } else if (stock !== undefined) {
    if (hasVariants(current)) {
      return badRequest(
        "This product's stock is the total of its size/colour variants — edit those instead"
      );
    }
    updates.stock = available(stock);
  }

  let updated: ProductDoc | null;
  try {
    updated = await products(db).findOneAndUpdate(
      { id },
      {
        $set: updates,
        ...(clearVariants || clearColorImages || clearImages
          ? {
              $unset: {
                ...(clearVariants ? { variants: "" } : {}),
                ...(clearColorImages ? { colorImages: "" } : {}),
                ...(clearImages ? { images: "" } : {}),
              },
            }
          : {}),
      },
      { returnDocument: "after" }
    );
  } catch (err) {
    // A hand-typed SKU that another product already owns; the unique index on
    // `variants.sku` is what catches it.
    if (isDuplicateKeyError(err)) {
      return badRequest("One of these SKUs is already used by another product");
    }
    throw err;
  }

  if (!updated) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(serializeAdminProduct(updated, held));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await requireAdmin();
  if (!session) {
    return adminUnauthorized();
  }

  const { id } = await params;
  const { db } = await connectToDB();
  const result = await products(db).deleteOne({ id });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
