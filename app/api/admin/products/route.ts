import { connectToDB } from "@/app/api/db";
import { normalizeProductImageUrl, slugifyProductId } from "@/app/lib/admin";
import { serializeAdminProduct } from "@/app/lib/admin-products";
import { adminUnauthorized, requireAdmin } from "@/app/lib/admin-auth";
import { products as productsCollection } from "@/app/lib/db-collections";
import { badRequest, parseBody } from "@/app/lib/api-request";
import { isDuplicateKeyError } from "@/app/lib/mongo-errors";
import { adminProductCreateSchema, resolveVariants } from "@/app/lib/schemas";
import { heldStockFor } from "@/app/lib/stock-hold";
import { totalVariantStock, type ColorImage } from "@/app/lib/variants";
import { NextRequest, NextResponse } from "next/server";
import { localeFromRequest } from "@/app/i18n/request";
import { apiDictionaryFor } from "@/app/i18n/lookup";

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return adminUnauthorized(req);
  }

  const { db } = await connectToDB();
  const products = await productsCollection(db).find({}).sort({ name: 1 }).toArray();
  const held = await heldStockFor(db, products.map((p) => p.id));

  return NextResponse.json(
    products.map((doc) => serializeAdminProduct(doc, held.get(doc.id)))
  );
}

export async function POST(req: NextRequest) {
  const t = apiDictionaryFor(localeFromRequest(req));

  const session = await requireAdmin();
  if (!session) {
    return adminUnauthorized(req);
  }

  const parsed = await parseBody(req, adminProductCreateSchema);
  if (!parsed.ok) return parsed.response;
  const { name, description, price, category } = parsed.data;

  // Every photo goes through the same host allowlist as the main image.
  let imageUrl: string;
  let colorImages: ColorImage[] | undefined;
  let images: string[] | undefined;
  try {
    imageUrl = normalizeProductImageUrl(parsed.data.imageUrl, t.image);
    colorImages = parsed.data.colorImages?.length
      ? parsed.data.colorImages.map((entry) => ({
          color: entry.color,
          imageUrl: normalizeProductImageUrl(entry.imageUrl, t.image),
        }))
      : undefined;
    images = parsed.data.images?.length
      ? parsed.data.images.map((url) => normalizeProductImageUrl(url, t.image))
      : undefined;
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : t.image.invalid);
  }

  const id = parsed.data.id
    ? slugifyProductId(parsed.data.id)
    : slugifyProductId(name);

  const { db } = await connectToDB();
  const existing = await productsCollection(db).findOne({ id });
  if (existing) {
    return NextResponse.json(
      { error: t.productIdTaken },
      { status: 409 }
    );
  }

  // With variants, the product-level count is their sum: one number the
  // catalog can sort and filter on without loading every size.
  const variants = parsed.data.variants?.length
    ? resolveVariants(id, parsed.data.variants)
    : undefined;
  const stock = variants ? totalVariantStock(variants) : (parsed.data.stock ?? 0);

  const product = {
    id,
    name,
    description,
    imageUrl,
    price,
    category,
    stock,
    ...(variants ? { variants } : {}),
    ...(colorImages ? { colorImages } : {}),
    ...(images ? { images } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // A product that did not exist a moment ago can have nothing held against it.
  try {
    await productsCollection(db).insertOne(product);
  } catch (err) {
    // The unique index on `variants.sku` caught a SKU already in use — either
    // hand-typed against another product, or a second save that raced the
    // findOne above.
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: t.productOrSkuTaken },
        { status: 409 }
      );
    }
    throw err;
  }
  return NextResponse.json(serializeAdminProduct(product), { status: 201 });
}
