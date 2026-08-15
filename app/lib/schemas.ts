import { z } from "zod";
import { MAX_CART_QUANTITY } from "@/app/lib/cart-limits";
import { MAX_PRODUCT_IMAGES } from "@/app/lib/images";
import {
  MAX_PRODUCT_VARIANTS,
  MAX_SKU_LENGTH,
  SKU_PATTERN,
  buildVariantSku,
  variantComboKey,
} from "@/app/lib/variants";

/**
 * Request body schemas for every route that accepts JSON.
 *
 * The type checks here are what stop MongoDB operator injection: a body like
 * `{"productId": {"$gt": ""}}` used to pass a truthiness check and reach
 * `findOne({ id: productId })` as a live query operator.
 */

/**
 * Stripe caps a metadata value at 500 characters. The cart is packed into
 * `cartItems*` values for fulfillment (see buildCartMetadata), so this cap and
 * the chunk budget there are set together: every cart these schemas accept
 * must encode in full.
 */
export const MAX_CART_LINE_ITEMS = 25;

export const productIdSchema = z.string().trim().min(1).max(64);

/** Same injection concern as productIdSchema: a SKU reaches a live query. */
export const variantSkuSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SKU_LENGTH)
  .regex(SKU_PATTERN, "SKU may contain only letters, numbers, . _ and -");

/** Optional everywhere: single-SKU products send no SKU at all. */
const cartVariantSku = variantSkuSchema.optional();

export const cartItemSchema = z.object({
  productId: productIdSchema,
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
  variantSku: cartVariantSku,
});

export const cartPostSchema = z.object({
  productId: productIdSchema,
  variantSku: cartVariantSku,
});

export const cartPatchSchema = z.object({
  productId: productIdSchema,
  // 0 removes the line item.
  quantity: z.number().int().min(0).max(MAX_CART_QUANTITY),
  variantSku: cartVariantSku,
});

export const cartDeleteSchema = z.object({
  productId: productIdSchema,
  variantSku: cartVariantSku,
});

export const cartMergeSchema = z.object({
  items: z.array(cartItemSchema).max(MAX_CART_LINE_ITEMS),
});

export const guestCheckoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(MAX_CART_LINE_ITEMS),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(200),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const passwordChangeSchema = z.object({
  // Absent when an OAuth account is setting a password for the first time.
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(8).max(200),
});

/** ISO 3166-1 alpha-2, matching the countries Checkout accepts. */
export const addressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullish().transform((v) => v || null),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).nullish().transform((v) => v || null),
  postalCode: z.string().trim().min(1).max(20),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase()),
});

/** One size/colour row from the admin form. */
export const productVariantInputSchema = z.object({
  // Omitted for new rows; the server derives a deterministic SKU. Sent back
  // unchanged when editing so existing carts keep pointing at the same line.
  sku: variantSkuSchema.optional(),
  /** EU size, kept as text so half sizes ("42.5") survive. */
  size: z.string().trim().min(1).max(10),
  color: z.string().trim().min(1).max(40),
  stock: z.number().int().nonnegative().max(1_000_000),
});

/**
 * Fills in missing SKUs, then rejects duplicates. Two rows with the same size
 * and colour would split one combination's stock across two lines, and a
 * repeated SKU would make `variants.$` update whichever row Mongo saw first.
 */
export const productVariantsSchema = z
  .array(productVariantInputSchema)
  .max(MAX_PRODUCT_VARIANTS)
  .superRefine((variants, ctx) => {
    const combos = new Set<string>();
    for (const [index, variant] of variants.entries()) {
      const combo = variantComboKey(variant.size, variant.color);
      if (combos.has(combo)) {
        ctx.addIssue({
          code: "custom",
          path: [index],
          message: `Duplicate variant: EU ${variant.size} / ${variant.color}`,
        });
      }
      combos.add(combo);
    }
  });

/** Resolve each row's final SKU. Kept out of the schema so the product id — known only to the route — can seed it. */
export function resolveVariants(
  productId: string,
  variants: z.infer<typeof productVariantsSchema>
): { sku: string; size: string; color: string; stock: number }[] {
  const used = new Set<string>();
  return variants.map((variant) => {
    const base = variant.sku ?? buildVariantSku(productId, variant.size, variant.color);
    // Truncation or a hand-typed SKU can still collide; disambiguate rather
    // than let two rows share an identity.
    let sku = base;
    let suffix = 2;
    while (used.has(sku)) {
      sku = `${base.slice(0, MAX_SKU_LENGTH - 3)}-${suffix++}`;
    }
    used.add(sku);
    return { sku, size: variant.size, color: variant.color, stock: variant.stock };
  });
}

/** One photo per colourway. Colour names are matched against the variants. */
export const colorImagesSchema = z
  .array(
    z.object({
      color: z.string().trim().min(1).max(40),
      imageUrl: z.url().max(2000),
    })
  )
  .max(MAX_PRODUCT_VARIANTS);

/**
 * Extra gallery photos, in display order.
 *
 * No floor: every product created before the gallery existed has none, and a
 * minimum would reject them the first time an admin edited anything else.
 * Ceiling is MAX_PRODUCT_IMAGES (the ticket's 4–5). Duplicates pass —
 * productGallery collapses them, and failing a save over a repeated URL helps
 * nobody.
 */
export const productImagesSchema = z
  .array(z.url().max(2000))
  .max(MAX_PRODUCT_IMAGES);

export const adminProductCreateSchema = z
  .object({
    id: productIdSchema.optional(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    imageUrl: z.url().max(2000),
    price: z.number().finite().nonnegative().max(1_000_000),
    // Optional because a product with variants derives its total from them.
    stock: z.number().int().nonnegative().max(1_000_000).optional(),
    variants: productVariantsSchema.optional(),
    colorImages: colorImagesSchema.optional(),
    images: productImagesSchema.optional(),
  })
  .refine((v) => v.variants?.length || v.stock !== undefined, {
    message: "Provide a stock count or at least one size/colour variant",
    path: ["stock"],
  });

/** PATCH accepts any subset, but rejects an entirely empty body. */
export const adminProductUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    imageUrl: z.url().max(2000),
    price: z.number().finite().nonnegative().max(1_000_000),
    stock: z.number().int().nonnegative().max(1_000_000),
    // An empty array clears the variants and returns the product to a single SKU.
    variants: productVariantsSchema,
    // Likewise, an empty array clears the per-colourway photos.
    colorImages: colorImagesSchema,
    // And an empty array clears the gallery, leaving the main image alone.
    images: productImagesSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
