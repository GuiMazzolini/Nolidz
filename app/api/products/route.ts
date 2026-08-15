import { connectToDB } from "../db";
import { products as productsCollection } from "@/app/lib/db-collections";
import {
  isSellableForPublic,
  serializePublicProduct,
} from "@/app/lib/public-products";

export async function GET() {
    const { db } = await connectToDB();
    const products = await productsCollection(db).find({}).toArray();

    return new Response(
        JSON.stringify(
          products
            .filter(isSellableForPublic)
            .map((doc) => serializePublicProduct(doc))
        ),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
};
