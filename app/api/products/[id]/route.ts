import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "../../db";
import { products as productsCollection } from "@/app/lib/db-collections";
import {
  isSellableForPublic,
  serializePublicProduct,
} from "@/app/lib/public-products";

type Params = { id: string };

export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
    const { db } = await connectToDB();
    const { id } = await params;

    const product = await productsCollection(db).findOne({ id: id })

    if (!product || !isSellableForPublic(product)) {
        return NextResponse.json(
            { error: 'Product not found!' },
            { status: 404 }
        );
    };

    return NextResponse.json(serializePublicProduct(product));
};