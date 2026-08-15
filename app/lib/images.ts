const CLOUDINARY_TRANSFORM = "w_1200,q_auto,f_auto";

/**
 * A product carries as many gallery photos as the admin uploads — no cap. How
 * many shots a listing needs is a per-product judgement (a technical runner
 * earns more angles than a beanie), so it is left to the person looking at the
 * photography. The page weight that would otherwise argue for a limit is
 * handled by lazy-loading everything past the first image; see ProductGallery.
 *
 * The main `imageUrl` is not part of the array. It stays the single canonical
 * thumbnail that cart lines, order rows, and OG tags read, so the gallery a
 * shopper sees is it plus these — see productGallery.
 */

/**
 * Normalize product image URLs and, for Cloudinary delivery URLs,
 * inject lightweight transforms so the browser downloads a smaller asset.
 *
 * Correct Cloudinary shape:
 *   .../image/upload/<transforms>/<version>/<public_id>
 */
export function getImageSrc(imageUrl: string): string {
  const url = imageUrl?.trim();
  if (!url) return url;

  if (url.startsWith("http") && url.includes("/image/upload/")) {
    // Already transformed (by us or manually) — leave alone.
    if (url.includes(CLOUDINARY_TRANSFORM)) {
      return url;
    }

    // Insert transforms immediately after /image/upload/
    return url.replace(
      /\/image\/upload\//,
      `/image/upload/${CLOUDINARY_TRANSFORM}/`
    );
  }

  return url.startsWith("http") ? url : `/${url.replace(/^\//, "")}`;
}

/**
 * Every photo of a product, main image first, ready to render.
 *
 * Deduplicated because the admin form uploads the main image and the gallery
 * through the same picker, and the same Cloudinary URL landing in both is an
 * easy mistake to make — one that would otherwise show as a duplicate
 * thumbnail. Blank entries are dropped rather than rendered as broken images.
 */
export function productGallery(product: {
  imageUrl: string;
  images?: string[] | null;
}): string[] {
  const seen = new Set<string>();
  const gallery: string[] = [];

  for (const raw of [product.imageUrl, ...(product.images ?? [])]) {
    const src = getImageSrc(raw ?? "");
    if (src && !seen.has(src)) {
      seen.add(src);
      gallery.push(src);
    }
  }

  return gallery;
}
