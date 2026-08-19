/**
 * English messages returned by Route Handlers and Zod schemas.
 *
 * These are the strings a shopper actually reads when something goes wrong —
 * every one of them is surfaced verbatim by a `data.error` render — so they
 * are translated even though they never appear in JSX.
 */
const api = {
  unauthorized: "Unauthorized",
  tooManyRequests: "Too many requests. Please try again later.",
  invalidBody: "Invalid request body",
  invalidJson: "Invalid JSON body",

  accountExists: "An account with this email already exists.",
  accountNotFound: "Account not found",
  currentPasswordWrong: "Your current password is incorrect",
  currentPasswordRequired: "Your current password is required",
  newPasswordMustDiffer: "The new password must be different",

  productNotFound: "Product not found",
  productIdTaken: "A product with this id already exists",
  productOrSkuTaken: "A product or variant with this id or SKU already exists",
  skuTakenByAnotherProduct:
    "One of these SKUs is already used by another product",

  /** Thrown by normalizeProductImageUrl and surfaced as a 400. */
  image: {
    invalid: "Invalid image URL",
    notAbsolute: "Image URL must be a valid absolute URL",
    notHttps: "Image URL must use https",
    hostNotAllowed: (hosts: string) =>
      `Image URL host must be one of: ${hosts}`,
  },

  chooseSizeAndColour: "Choose a size and colour",
  outOfStock: "Out of stock",
  onlyNInStock: (stock: number) => `Only ${stock} in stock`,
  itemNotInCart: "Item not found in cart",

  cartEmpty: "Cart is empty",
  cartTooLarge: "Cart is too large to check out. Please remove some items.",
  paymentsNotConfigured: "Payments are not configured. Please contact us.",
  paymentProviderUnavailable: "Payment provider is unavailable. Please try again.",
  checkoutSessionFailed: "Could not create checkout session",

  missingOrderId: "Missing order id",
  orderNotFound: "Order not found",
  trackingNumberRequired: "Tracking number is required",

  cloudinaryNotConfigured: "Cloudinary is not configured",
};

export type ApiDict = typeof api;
export default api;
