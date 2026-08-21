/**
 * English storefront copy.
 *
 * This module is the shape of record: `StorefrontDict` is derived from it, and
 * `storefront.de.ts` is typed against that, so a key added here fails the build
 * until German has it too.
 *
 * Anything with a moving part is a function rather than a string with tokens.
 * German inflects around inserted values — "3 Paar" vs "1 Paar", "im Warenkorb"
 * vs "in den Warenkorb" — and a template string cannot express that, so the
 * translation would have to be bent around the English sentence shape.
 */
const storefront = {
  common: {
    /**
     * The shipping area in the reader's language. The list of countries it
     * describes is SHIPPING_COUNTRIES in app/lib/shipping.ts — widen that and
     * this wording has to follow, in both locales.
     */
    shippingArea: "Germany",
    brandTagline: "Outlet finds. Open boxes. Real pairs.",
    continueShopping: "Continue shopping",
    backToHome: "Back to home",
    browseProducts: "Browse products",
    tryAgain: "Try again",
    cancel: "Cancel",
    dismiss: "Dismiss",
    free: "FREE",
    or: "or",
    optional: "optional",
    loading: "Loading…",
    saving: "Saving…",
    pleaseWait: "Please wait…",
    skipToContent: "Skip to content",
  },

  nav: {
    women: "Women",
    men: "Men",
    kids: "Kids",
    all: "All",
    shopBy: "Shop by",
    cart: "Cart",
    cartWithCount: (count: number) => `Cart, ${count} items`,
    logIn: "Log in",
    signUp: "Sign up",
    accountMenu: "Account menu",
    account: "Account",
    orderHistory: "Order history",
    accountSettings: "Account settings",
    admin: "Admin",
    signOut: "Sign out",
    language: "Language",
    switchToGerman: "Auf Deutsch ansehen",
    switchToEnglish: "View in English",
  },

  home: {
    metaTitle: "nolidz — Outlet sneaker finds",
    metaDescription:
      "One-of-a-kind sneakers pulled from outlet hunts. Unboxed, photographed, and ready to wear. No lids. Just pairs.",
    ogDescription:
      "One-of-a-kind sneakers pulled from outlet hunts. Unboxed, photographed, and ready to wear.",
    eyebrow: "Outlet sneaker hunts",
    headlineTop: "no lids.",
    headlineBottom: "just pairs.",
    heroBody:
      "We tear through outlet stock so you don't have to. One-of-a-kind sneakers, unboxed and ready to wear. What you see is what we pulled.",
    shopCta: "Shop the finds",
    howItWorks: "How it works",
    heroImageAlt: "nolidz — sneakers in an open box",
    huntEyebrow: "The hunt",
    huntHeading: "Straight from the outlet",
    huntBody:
      "nolidz is not a warehouse of infinite sizes. It's a curated resale of real outlet finds — opened, checked, and listed one pair at a time.",
    steps: [
      {
        number: "01",
        title: "Hunt",
        description:
          "We hit outlets and factory stores looking for pairs actually worth reselling — not leftover sizes nobody wants.",
      },
      {
        number: "02",
        title: "Unbox",
        description:
          "Every pair comes out of the box. No lids, no mysteries. You see the sneakers we pulled, photographed as they are.",
      },
      {
        number: "03",
        title: "Drop",
        description:
          "Once it's listed, it's a one-off. When a pair is gone, it's gone. The next hunt starts again.",
      },
    ],
    latestEyebrow: "Latest finds",
    latestHeading: "In the box",
    viewAll: "View all pairs →",
    emptyHeading: "First drop coming soon",
    emptyBody:
      "The next outlet hunt is already happening. Check back for the pairs that make it out of the box.",
    closingHeading: "The next hunt is already happening",
    closingBody:
      "Limited finds. No restocks. If a pair speaks to you, grab it before it walks.",
    closingCta: "Shop nolidz",
  },

  catalog: {
    metaTitle: "Products",
    metaDescription:
      "Browse outlet sneaker finds from nolidz — unboxed, photographed, and ready to wear.",
    eyebrow: "Catalog",
    headingAll: "The finds",
    countLabel: (shown: number, total: number) => `${shown} of ${total} items`,
    search: "Search",
    searchPlaceholder: "Name, colour, or description",
    sort: "Sort",
    sortNameAsc: "Name A–Z",
    sortPriceAsc: "Price: low to high",
    sortPriceDesc: "Price: high to low",
    sortStockDesc: "Stock: high to low",
    emptyHeading: "No products match",
    emptyBody: "Try a different category, search term, or reset the filters.",
    resetFilters: "Reset filters",
  },

  productCard: {
    manySizes: "Available in several sizes",
    outOfStockBadge: "Out of stock",
    outOfStock: "Out of Stock",
    chooseSize: "Choose Size",
    inCartAddSize: (units: number) => `In cart (${units}) · Add size`,
    addToCart: "Add to Cart",
    adding: "Adding…",
    stockLeft: (count: number) => `${count} left`,
    view: (label: string) => `View ${label}`,
    photoOf: (label: string, index: number, total: number) =>
      `${label} — photo ${index} of ${total}`,
    previousPhotoOf: (label: string) => `Previous photo of ${label}`,
    nextPhotoOf: (label: string) => `Next photo of ${label}`,
    soldOutSwatch: (color: string) => `${color} — sold out`,
    removeFromCart: "Remove from cart",
    decreaseQuantity: "Decrease quantity",
    increaseQuantity: "Increase quantity",
  },

  productDetail: {
    notFoundTitle: "Product not found",
    colourLabel: "Colour:",
    sizeHeadingEu: "EU size",
    sizeHeadingPlain: "Size",
    chooseSizeHint: "Choose your size to add this to the cart.",
    variantStockTitle: (count: number) => `${count} available`,
    description: "Description",
    addToCart: "Add to Cart",
    removeFromCart: "Remove from Cart",
    outOfStock: "Out of Stock",
    selectASize: "Select a Size",
    buyNow: "Buy Now",
    processing: "Processing…",
    shipsToOnly: (area: string) => `Ships to ${area} only`,
    /**
     * Priced from SHIPPING_METHODS rather than written out, so a rate change
     * is one edit and this line cannot quietly promise a price that checkout
     * no longer charges.
     */
    shippingRates: (standard: string, threshold: string, express: string) =>
      `Standard ${standard} · free over ${threshold} · express ${express}`,
    easyReturns: "Easy Returns",
    returnPolicy: "15-day return policy",
    inColour: (name: string, color: string) => `${name} in ${color}`,
    stock: {
      outOfStockEverySize: "Out of stock in every size",
      selectSizeForAvailability: "Select a size to see availability",
      sizeSoldOut: "This size is sold out",
      onlyLeftInSize: (count: number, size: string) =>
        `Only ${count} left in ${size}`,
      inStockInSize: (count: number, size: string) =>
        `${count} in stock in ${size}`,
      outOfStock: "Out of stock",
      onlyLeft: (count: number) => `Only ${count} left`,
      inStock: (count: number) => `${count} in stock`,
    },
  },

  gallery: {
    photosOf: (alt: string) => `${alt} photos`,
    photoOf: (alt: string, index: number, total: number) =>
      `${alt} — photo ${index} of ${total}`,
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    productPhotos: "Product photos",
    showPhoto: (index: number, total: number) =>
      `Show photo ${index} of ${total}`,
  },

  shippingBanner: {
    shipToOnly: (area: string) => `We ship to ${area} only.`,
    body: (area: string) =>
      `You can browse and order, but checkout accepts a ${area} delivery address.`,
    dismiss: "Dismiss shipping notice",
  },

  cart: {
    metaTitle: "Shopping Cart",
    metaDescription: "Review the items in your cart before checking out.",
    eyebrow: "Checkout",
    heading: "Shopping Cart",
    emptyHeading: "Your cart is empty",
    emptyBody: "Looks like you haven't added any items yet.",
    guestNoticeLead: "You're shopping as a guest — you can checkout without an account.",
    guestNoticeLogIn: "Log in",
    guestNoticeTail: "to save your cart across devices and view order history.",
    orderSummary: "Order Summary",
    subtotal: (items: number) => `Subtotal (${items} items)`,
    shipping: "Shipping",
    freeShippingHint: (amount: string) => `Add ${amount} more for free shipping.`,
    /**
     * The cart quotes standard delivery because the choice is made one step
     * later, on Stripe's page. Saying so here stops the total below reading as
     * a promise a buyer can then watch go up.
     */
    shippingStandardNote: "Standard delivery — faster options at checkout.",
    total: "Total",
    deliveryOnly: (area: string) => `Delivery to ${area} only.`,
    deliveryOnlyTail: (area: string) => `Checkout accepts a ${area} address.`,
    payButton: "Pay with card or PayPal",
    redirecting: "Redirecting…",
    secureCheckout: "Secure checkout on Stripe (card or PayPal).",
    secureCheckoutGuest: "No account needed — ",
    secureCheckoutTail: "shipping and email are collected there.",
    holdNotice: (minutes: number) =>
      `Popular sizes go quickly — your basket doesn't hold them. We'll set your size aside for ${minutes} minutes once you continue to payment.`,
    itemAvailable: (count: number) => `${count} available`,
    itemOutOfStock: "Out of stock",
    eachPrice: (amount: string) => `(${amount} each)`,
    removeFromCart: "Remove from cart",
    decreaseQuantity: "Decrease quantity",
    increaseQuantity: "Increase quantity",
    dismissError: "Dismiss error",
  },

  checkoutSuccess: {
    metaTitle: "Order confirmed",
    thankYou: "Thank you!",
    paymentStatus: "Payment status",
    paidBody:
      "Your order was received. A nolidz confirmation email is on its way (plus Stripe's receipt).",
    unconfirmedBody:
      "We could not confirm this payment. If you were charged, contact support with your session details.",
    noSessionBody: "Return to the store to complete a purchase.",
    lookUpOrder: "Look up this order",
  },

  orders: {
    metaTitle: "Order History",
    eyebrow: "Account",
    heading: "Order History",
    intro: "Your past purchases. Open an order for items, shipping, and tracking.",
    emptyHeading: "No orders yet",
    emptyBody: "When you complete a purchase, your orders will show up here.",
    startShopping: "Start shopping",
    viewDetails: "View order details →",

    statusShipped: "Shipped",
    statusPaid: "Paid",

    orderPlaced: "Order placed",
    total: "Total",
    totalPaid: "Total paid",
    subtotal: "Subtotal",
    shipping: "Shipping",
    shippedTo: "Shipped to",
    itemQuantity: (quantity: number) => `× ${quantity}`,

    tracking: "Tracking",
    carrier: (name: string) => `Carrier: ${name}`,
    shippedOn: (date: string) => `Shipped ${date}`,
    lastUpdate: (date: string) => `Last update ${date}`,

    detailMetaTitle: "Order Details",
    detailHeading: "Order details",
    orderReference: "Order reference:",
    backToOrders: "← Back to orders",
    notFoundHeading: "Order not found",
    notFoundBody:
      "We couldn't find an order with those details. If you checked out as a guest, try the guest lookup page with the same email used at checkout.",
    guestLookupCta: "Guest order lookup",
    backToOrdersPlain: "Back to orders",

    lookupMetaTitle: "Guest Order Lookup",
    lookupHeading: "Guest order lookup",
    lookupIntro:
      "Enter the email used at checkout and your order reference (session_id) from the success page or confirmation email.",
    lookupEmailLabel: "Email used at checkout",
    lookupReferenceLabel: "Order reference / session id",
    lookupSubmit: "Find order",
    lookupNoMatch: "We couldn't find an order for that email and reference.",
    lookupViewFull: "View full order details →",
  },

  trackingStatus: {
    preTransit: "Label created — the carrier has not scanned it yet",
    transit: "On its way",
    delivered: "Delivered",
    failure: "Delivery problem — contact us",
    unknown: "Status unavailable",
  },

  login: {
    metaTitle: "Log in",
    metaDescription:
      "Log in or create a nolidz account to save your cart and checkout.",
    titleLogin: "Welcome back",
    titleSignup: "Create your account",
    subtitleLogin: "Log in to save your cart and checkout.",
    subtitleSignup: "Sign up to start shopping with a saved cart.",
    tabLogin: "Log in",
    tabSignup: "Sign up",
    nameLabel: "Name",
    namePlaceholder: "Your name",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholderSignup: "At least 8 characters",
    passwordPlaceholderLogin: "Your password",
    submitLogin: "Log in",
    submitSignup: "Create account",
    continueWithGitHub: "Continue with GitHub",
    continueWithGoogle: "Continue with Google",
    continueShopping: "Continue shopping",
    withoutAccount: " without an account",
    errorCreateAccount: "Could not create account.",
    errorInvalidCredentials: "Invalid email or password.",
    errorSignupLoginFailed: "Account created, but login failed. Try logging in.",
    errorGeneric: "Something went wrong. Please try again.",
  },

  account: {
    metaTitle: "Account Settings",
    heading: "Account settings",
    intro: "Manage your profile, password, and shipping address.",

    profileTitle: "Profile",
    profileDescription: "This name appears in the navbar and on your order emails.",
    displayName: "Display name",
    emailLabel: "Email",
    emailLocked:
      "Your email identifies your cart and order history, so it can't be changed here. Contact support if you need it updated.",
    saveProfile: "Save profile",
    profileUpdated: "Profile updated.",

    passwordTitle: "Password",
    passwordTitleSet: "Set a password",
    passwordDescription: "Choose a new password of at least 8 characters.",
    passwordDescriptionSet:
      "You signed in with a social account. Setting a password lets you also sign in with your email — your social login keeps working.",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    changePassword: "Change password",
    setPassword: "Set password",
    passwordChanged: "Password changed.",
    passwordSet: "Password set.",
    passwordsDoNotMatch: "The new passwords do not match.",

    addressTitle: "Shipping address",
    addressDescription:
      "Germany only. Saved to your Stripe customer record so it prefills at checkout — you can still change it during payment.",
    addressDropped: (area: string) =>
      `Your saved address was outside ${area}, so we cleared it. Please enter a ${area} address.`,
    line1: "Address line 1",
    line2: "Address line 2",
    city: "City",
    state: "State / Province",
    postalCode: "Postal code",
    country: "Country",
    countryName: "Germany",
    saveAddress: "Save address",
    removeAddress: "Remove address",
    addressSaved: "Address saved. Checkout will prefill it.",
    addressRemoved: "Address removed.",

    deleteTitle: "Delete account",
    deleteBody:
      "Permanently deletes your account and saved cart. Past orders are kept as purchase records — you can still find them with your email and order reference on the guest lookup page.",
    deleteCta: "Delete my account",
    /** The word the customer must type to arm the delete button. */
    deleteConfirmWord: "DELETE",
    /** Split around the word, which renders in a monospace span between them. */
    deleteConfirmBefore: "Type ",
    deleteConfirmAfter: " to confirm",
    deleteConfirm: "Permanently delete",
    deleting: "Deleting…",
    errorCouldNotSave: "Could not save",
    errorCouldNotRemove: "Could not remove",
    errorCouldNotDelete: "Could not delete account",
    errorGeneric: "Something went wrong",
  },

  footer: {
    copyright: (year: number) => `© ${year} Kristiyan Valin`,
    impressum: "Impressum",
    datenschutz: "Datenschutz",
    widerruf: "Widerruf",
  },

  sizeGuide: {
    link: "Size guide",
    title: "Size Guide",
    close: "Close",
    note: "Sizes are approximate. If you're between sizes, we recommend sizing up.",
    adults: "Adults (EU 36–47)",
    kids: "Kids (EU 28–35)",
  },

  notFound: {
    metaTitle: "Page not found",
    heading: "Page not found",
    body: "The page you're looking for doesn't exist or may have been moved.",
  },

  error: {
    heading: "Something went wrong",
    body: "An unexpected error occurred. Please try again.",
  },
};

export type StorefrontDict = typeof storefront;
export default storefront;
