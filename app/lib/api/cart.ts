import { Product } from "../../product-data";

/**
 * Same-origin by default so production never hits localhost.
 * Override only when the API is hosted on a different origin.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class CartRequestError extends Error {
  status: number;
  constructor(status: number) {
    super(`Cart request failed: ${status}`);
    this.name = "CartRequestError";
    this.status = status;
  }
}

async function request(
  method: string,
  body?: unknown,
  path = "/api/cart"
): Promise<Product[]> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    throw new CartRequestError(res.status);
  }

  return res.json();
}

export function fetchCartItems() {
  return request("GET");
}

/** Omitted for single-SKU products; identifies the size/colour otherwise. */
function variantBody(variantSku?: string) {
  return variantSku ? { variantSku } : {};
}

export function addCartItem(productId: string, variantSku?: string) {
  return request("POST", { productId, ...variantBody(variantSku) });
}

export function updateCartQuantity(
  productId: string,
  quantity: number,
  variantSku?: string
) {
  return request("PATCH", { productId, quantity, ...variantBody(variantSku) });
}

export function removeCartItem(productId: string, variantSku?: string) {
  return request("DELETE", { productId, ...variantBody(variantSku) });
}

export function mergeGuestCart(
  items: { productId: string; quantity: number; variantSku?: string }[]
) {
  return request("POST", { items }, "/api/cart/merge");
}
