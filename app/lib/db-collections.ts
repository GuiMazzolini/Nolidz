import type { Db } from "mongodb";
import type { ProductCategory } from "@/app/lib/categories";
import type { Order } from "@/app/lib/orders";
import type { ReservationDoc } from "@/app/lib/reservations";
import type { ColorImage, ProductVariant } from "@/app/lib/variants";

/**
 * Typed accessors for every collection in the database.
 *
 * `db.collection(name)` returns `Collection<Document>`, so `find().toArray()`
 * yields `WithId<Document>[]` and any concrete callback annotation is a type
 * error. Declaring the document shape once here keeps every call site typed
 * without per-file annotations or casts.
 */

export type ProductDoc = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  /** Mirror of the variant total when `variants` is set; see lib/variants. */
  stock: number;
  /** Audience listing. Absent on products created before categories existed. */
  category?: ProductCategory;
  /** Absent on single-SKU products, which sell straight off `stock`. */
  variants?: ProductVariant[];
  /** Optional per-colourway photos; the main `imageUrl` is the fallback. */
  colorImages?: ColorImage[];
  /**
   * Extra gallery photos in display order, capped at MAX_PRODUCT_IMAGES.
   * The main `imageUrl` is not repeated here — see productGallery in lib/images.
   */
  images?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * One cart line. `variantSku` is absent for single-SKU products, so the same
 * shoe in two sizes is two documents in this array.
 */
export type CartItemDoc = {
  productId: string;
  quantity: number;
  variantSku?: string;
};

export type CartDoc = {
  userId: string;
  items: CartItemDoc[];
  createdAt?: Date;
  updatedAt?: Date;
};

/** Saved shipping address. Field names mirror Stripe's address shape. */
export type SavedAddress = {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
};

export type UserDoc = {
  email: string;
  name: string;
  /**
   * Absent for OAuth accounts, which never set one. Any password flow must
   * branch on this rather than assume it exists.
   */
  passwordHash?: string;
  address?: SavedAddress | null;
  /** Set lazily when an address is first saved; used to prefill Checkout. */
  stripeCustomerId?: string;
  /** "credentials" | "github" | "google" — how the account was created. */
  provider?: string;
  createdAt: Date;
  updatedAt?: Date;
};

/** One fixed-window counter. `expiresAt` is swept by a TTL index. */
export type RateLimitDoc = {
  _id: string;
  count: number;
  expiresAt: Date;
};

export const products = (db: Db) => db.collection<ProductDoc>("products");
export const carts = (db: Db) => db.collection<CartDoc>("carts");
export const users = (db: Db) => db.collection<UserDoc>("users");
export const orders = (db: Db) => db.collection<Order>("orders");
export const rateLimits = (db: Db) => db.collection<RateLimitDoc>("ratelimits");
export const reservations = (db: Db) =>
  db.collection<ReservationDoc>("reservations");
