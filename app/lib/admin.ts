export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Hosts a product image may be served from. Must stay in sync with
 * `images.remotePatterns` in next.config.ts and the CSP `img-src` directive.
 */
export const ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com"];

export type ImageUrlMessages = {
  notAbsolute: string;
  notHttps: string;
  hostNotAllowed: (hosts: string) => string;
};

const DEFAULT_IMAGE_MESSAGES: ImageUrlMessages = {
  notAbsolute: "Image URL must be a valid absolute URL",
  notHttps: "Image URL must use https",
  hostNotAllowed: (hosts) => `Image URL host must be one of: ${hosts}`,
};

/**
 * Validate and normalize an admin-supplied product image URL.
 * Throws when the URL is unparseable, not https, or off the allowlist.
 *
 * The rejection wording is a parameter so the admin reads it in their own
 * language; this module itself stays free of locale wiring, and the English
 * defaults are what the unit tests read.
 */
export function normalizeProductImageUrl(
  imageUrl: string,
  messages: ImageUrlMessages = DEFAULT_IMAGE_MESSAGES
): string {
  const trimmed = imageUrl.trim();

  // A same-origin path is the seeded photography in `public/`. It cannot point
  // off-site, so there is nothing for the host allowlist to protect against —
  // and rejecting it would make every seeded product uneditable in the admin.
  // `//evil.example.com` is protocol-relative, not same-origin, so it is out.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(messages.notAbsolute);
  }

  if (url.protocol !== "https:") {
    throw new Error(messages.notHttps);
  }
  if (!ALLOWED_IMAGE_HOSTS.includes(url.hostname)) {
    throw new Error(messages.hostNotAllowed(ALLOWED_IMAGE_HOSTS.join(", ")));
  }

  return url.toString();
}

/** URL-safe product id from a display name. */
export function slugifyProductId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || `product-${Date.now()}`;
}
