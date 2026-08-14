import { connectToDB } from "@/app/api/db";
import {
  isAdminEmail,
  normalizeProductImageUrl,
  slugifyProductId,
} from "@/app/lib/admin";
import { authOptions } from "@/app/lib/auth";
import { getAvailableStock } from "@/app/lib/cart-limits";
import { products as productsCollection } from "@/app/lib/db-collections";
import { badRequest, parseBody } from "@/app/lib/api-request";
import { adminProductCreateSchema, resolveVariants } from "@/app/lib/schemas";
import {
  serializeVariants,
  totalVariantStock,
  type ColorImage,
  type ProductVariant,
} from "@/app/lib/variants";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return null;
  }
  return session;
}

function serializeProduct(doc: Record<string, unknown>) {
  return {
    id: doc.id,
    name: doc.name,
    price: doc.price,
    description: doc.description,
    imageUrl: doc.imageUrl,
    stock: getAvailableStock(doc.stock),
    variants: serializeVariants(doc.variants as ProductVariant[] | undefined) ?? [],
    colorImages: (doc.colorImages as ColorImage[] | undefined) ?? [],
  };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { db } = await connectToDB();
  const products = await productsCollection(db).find({}).sort({ name: 1 }).toArray();
  return NextResponse.json(products.map(serializeProduct));
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(req, adminProductCreateSchema);
  if (!parsed.ok) return parsed.response;
  const { name, description, price } = parsed.data;

  let imageUrl: string;
  try {
    imageUrl = normalizeProductImageUrl(parsed.data.imageUrl);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Invalid image URL");
  }

  const id = parsed.data.id
    ? slugifyProductId(parsed.data.id)
    : slugifyProductId(name);

  const { db } = await connectToDB();
  const existing = await productsCollection(db).findOne({ id });
  if (existing) {
    return NextResponse.json({ error: "A product with this id already exists" }, { status: 409 });
  }

  // With variants, the product-level count is their sum: one number the
  // catalog can sort and filter on without loading every size.
  const variants = parsed.data.variants?.length
    ? resolveVariants(id, parsed.data.variants)
    : undefined;
  const stock = variants ? totalVariantStock(variants) : (parsed.data.stock ?? 0);

  // Colour photos go through the same host allowlist as the main image.
  let colorImages: ColorImage[] | undefined;
  try {
    colorImages = parsed.data.colorImages?.length
      ? parsed.data.colorImages.map((entry) => ({
          color: entry.color,
          imageUrl: normalizeProductImageUrl(entry.imageUrl),
        }))
      : undefined;
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Invalid image URL");
  }

  const product = {
    id,
    name,
    description,
    imageUrl,
    price,
    stock,
    ...(variants ? { variants } : {}),
    ...(colorImages ? { colorImages } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await productsCollection(db).insertOne(product);
  return NextResponse.json(serializeProduct(product), { status: 201 });
}
