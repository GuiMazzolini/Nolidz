import { v2 as cloudinary } from "cloudinary";

export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary configuration");
  }

  return { cloudName, apiKey, apiSecret };
}

function configureCloudinary() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return cloudName;
}

function looksLikeTransformSegment(segment: string): boolean {
  if (segment.includes(",")) return true;
  return /^(w_|h_|c_|q_|f_|g_|e_|b_|dpr_|fl_|ar_)/.test(segment);
}

/**
 * Pulls the destroyable public id out of a delivery URL we stored on a product.
 * Returns null for other hosts, clouds, or paths we cannot parse safely.
 */
export function publicIdFromCloudinaryUrl(
  url: string,
  cloudName: string
): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "res.cloudinary.com") return null;

    const prefix = `/${cloudName}/image/upload/`;
    if (!parsed.pathname.startsWith(prefix)) return null;

    const segments = parsed.pathname.slice(prefix.length).split("/").filter(Boolean);
    const versionIdx = segments.findIndex((s) => /^v\d+$/.test(s));

    let publicPath: string;
    if (versionIdx >= 0) {
      publicPath = segments.slice(versionIdx + 1).join("/");
    } else {
      const idStart = segments.findIndex((s) => !looksLikeTransformSegment(s));
      publicPath = segments.slice(idStart >= 0 ? idStart : 0).join("/");
    }

    if (!publicPath) return null;
    return publicPath.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

/** Every Cloudinary URL attached to a product doc, deduped. */
export function collectCloudinaryUrlsFromProduct(product: {
  imageUrl: string;
  colorImages?: { imageUrl: string }[];
  images?: string[];
}): string[] {
  const urls = [
    product.imageUrl,
    ...(product.colorImages?.map((entry) => entry.imageUrl) ?? []),
    ...(product.images ?? []),
  ];

  return [
    ...new Set(
      urls.filter((url) => url.includes("res.cloudinary.com"))
    ),
  ];
}

/**
 * Best-effort cleanup after a product is removed. Failures are logged but do
 * not roll back the database delete — a missing image is better than a ghost
 * product that still appears in admin.
 */
export async function deleteCloudinaryImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  let cloudName: string;
  try {
    cloudName = configureCloudinary();
  } catch {
    return;
  }

  const publicIds = [
    ...new Set(
      urls
        .map((url) => publicIdFromCloudinaryUrl(url, cloudName))
        .filter((id): id is string => Boolean(id))
    ),
  ];

  for (const publicId of publicIds) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch (err) {
      console.error(`Failed to delete Cloudinary image ${publicId}:`, err);
    }
  }
}

export function getCloudinaryUploadFolder() {
  return process.env.CLOUDINARY_UPLOAD_FOLDER || "nolidz/products";
}

export function signCloudinaryUpload(paramsToSign: Record<string, string>) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return {
    cloudName,
    apiKey,
    signature: cloudinary.utils.api_sign_request(paramsToSign, apiSecret),
  };
}

