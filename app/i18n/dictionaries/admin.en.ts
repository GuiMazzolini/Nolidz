/**
 * English admin copy.
 *
 * Kept in its own module rather than folded into the storefront dictionary:
 * the admin screens are the larger half of the app's text and only three
 * people ever see them, so bundling them with the shop would ship every
 * shopper a fulfillment vocabulary they never read.
 */
const admin = {
  nav: {
    eyebrow: "Admin",
    title: "Shop management",
    orders: "Orders",
    products: "Products",
    addProduct: "Add product",
  },

  products: {
    metaTitle: "Admin — Products",
    metaTitleNew: "Admin — New product",
    metaTitleEdit: "Admin — Edit product",
    eyebrow: "Catalog",
    heading: "Products",
    intro: "Manage catalog inventory, pricing, and product images.",
    addHeading: "Add product",
    editHeading: (name: string) => `Edit ${name}`,

    attentionHeading: "Inventory attention needed",
    /** One sentence rather than assembled fragments — the clauses join
     *  differently in German, and a comma cannot be a separate string. */
    attentionBody: (outOfStock: number, lowStock: number, threshold: number) => {
      const parts: string[] = [];
      if (outOfStock > 0) parts.push(`${outOfStock} out of stock`);
      if (lowStock > 0) parts.push(`${lowStock} low stock (≤ ${threshold})`);
      return `${parts.join(" · ")}. Use the filters below to review them.`;
    },

    search: "Search",
    searchPlaceholder: "Name or id",
    stockFilter: "Stock filter",
    filterAll: "All products",
    filterHealthy: "Healthy stock",
    filterLow: "Low stock",
    filterOut: "Out of stock",
    sort: "Sort",
    sortNameAsc: "Name A–Z",
    sortPriceAsc: "Price: low to high",
    sortPriceDesc: "Price: high to low",
    sortStockAsc: "Stock: low to high",
    showingCount: (shown: number, total: number) =>
      `Showing ${shown} of ${total} products`,

    colProduct: "Product",
    colCategory: "Category",
    colPrice: "Price",
    colStock: "Stock",
    colActions: "Actions",
    noMatches: "No products match these filters.",
    stockOutSuffix: " · Out",
    stockLowSuffix: " · Low",
    variantSummary: (inStock: number, total: number, soldOut: number) => {
      const base = `${inStock} of ${total} combos in stock`;
      return soldOut > 0 ? `${base} · ${soldOut} sold out` : base;
    },
    heldInCheckout: (count: number) => `${count} held in checkout`,
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: (name: string) => `Delete “${name}”? This cannot be undone.`,
    deleteFailed: "Delete failed",
  },

  form: {
    name: "Name",
    idOptional: "ID (optional)",
    idPlaceholder: "Auto-generated from name if empty",
    category: "Category",
    description: "Description",
    productImage: "Product image",
    cloudinaryPlaceholder: "https://res.cloudinary.com/…",
    uploading: "Uploading…",
    uploadImage: "Upload image",
    uploadHint: "Upload to Cloudinary, or paste a Cloudinary URL.",
    productPreview: "Product preview",
    imagePreview: "Image preview",
    previewBroken: "Couldn't load this image — check the URL.",
    noImageYet: "No image yet — upload one to see a preview",

    morePhotos: "More photos",
    morePhotosHint: (max: number) =>
      `Up to ${max} extra shots — profile, three-quarter, sole, detail. Shown after the main image, in this order.`,
    extraPhotoUrl: (index: number) => `Extra photo ${index} URL`,
    upload: "Upload",
    movePhotoUp: (index: number) => `Move photo ${index} up`,
    movePhotoDown: (index: number) => `Move photo ${index} down`,
    remove: "Remove",
    addPhoto: "Add photo",

    price: "Price (EUR)",
    priceFallbackHint: "Fallback for any colour without its own price below.",
    stock: "Stock",
    variantStockSummary: (total: number, variants: number) =>
      `${total} across ${variants} variant${variants === 1 ? "" : "s"}`,

    variantsLegend: "Sizes & colours",
    useVariants: "Sell this product by EU size and colour",
    useVariantsHint:
      "Each size/colour combination gets its own SKU and stock. Sizes are per colour — Black can stock 42 while White does not. Price is per colour too. Turning this off sells a single SKU.",
    addSizeRun: "Add a size run",
    addSizeRunHint:
      "Adds sizes for this colour only. White can skip 46 even if Black has it.",
    colour: "Colour",
    colourPlaceholder: "e.g. Black",
    stockPerSize: "Stock per size",
    tapSizeHint: "Tap a size to add it for this colour; tap again to remove.",
    enterColourFirst: "Enter a colour first, then tap the sizes you stock.",
    euSize: "EU size",
    euSizeForRow: (index: number) => `EU size for row ${index}`,
    colourForRow: (index: number) => `Colour for row ${index}`,
    stockForRow: (index: number) => `Stock for row ${index}`,
    colourPhotosAndPrices: "Colour photos and prices",
    colourPhotosHint:
      "Price is per colour — a limited run can cost more than the standard colour. Leave a price blank to use the default above. Leave a photo blank to fall back to the main image.",
    priceFor: (colour: string) => `Price for ${colour}`,
    photoUrlFor: (colour: string) => `Photo URL for ${colour}`,
    photoUrlPlaceholder: "https://res.cloudinary.com/… (optional)",
    addEmptyRow: "Add empty row",

    createProduct: "Create product",
    saveChanges: "Save changes",

    errors: {
      nameRequired: "Name is required.",
      descriptionRequired: "Description is required.",
      imageUrlInvalid: "Upload an image or paste a Cloudinary URL (https://…).",
      priceInvalid: "Enter a valid non-negative price.",
      stockInvalid: "Stock must be a whole number ≥ 0.",
      tooManyPhotos: (max: number) => `At most ${max} extra photos.`,
      photoUrlInvalid: "Each extra photo needs a Cloudinary URL (https://…).",
      noVariants: "Add at least one size/colour, or turn variants off.",
      tooManyVariants: (max: number) => `At most ${max} variants.`,
      variantNeedsSize: "Every variant needs an EU size.",
      variantNeedsColour: "Every variant needs a colour.",
      variantStockInvalid: (size: string, colour: string) =>
        `Stock for EU ${size} / ${colour} must be a whole number ≥ 0.`,
      variantDuplicate: (size: string, colour: string) =>
        `EU ${size} / ${colour} is listed twice.`,
      colourPriceInvalid: (colour: string) =>
        `Price for ${colour} must be a valid non-negative number.`,
      uploadStartFailed: "Could not start image upload",
      uploadFailed: "Image upload failed. Try another file.",
      uploadNetwork: "Image upload failed. Check your connection and try again.",
      fixHighlighted: "Please fix the highlighted fields before saving.",
      saveFailed: "Save failed",
      network: "Network error — please try again.",
    },
  },

  orders: {
    metaTitle: "Admin — Orders",
    eyebrow: "Fulfillment",
    heading: "Orders",
    summary: (total: number, awaiting: number) => {
      const count = `${total} order${total === 1 ? "" : "s"}`;
      const waiting = awaiting > 0 ? ` · ${awaiting} awaiting shipment` : "";
      return `${count}${waiting}. After you ship with DHL (or another carrier), add the tracking number below.`;
    },
    empty: "No orders yet. Complete a test checkout to see fulfillment here.",
    statusShipped: "Shipped",
    statusPaid: "Paid — pack & ship",
    customerView: "Customer view",
    items: "Items",
    shipTo: "Ship to",
    trackingNumber: (value: string) => `Tracking: ${value}`,
    carrier: (name: string) => `Carrier: ${name}`,
    markedShipped: (date: string) => `Marked shipped ${date}`,
    dhlPrefix: "DHL:",
    checkedAt: (date: string) => `Checked ${date}`,

    shipFormUpdate: "Update shipment",
    shipFormCreate: "Mark as shipped",
    shipFormHint:
      "After you drop the parcel at DHL (or another carrier), paste the tracking number here.",
    trackingNumberLabel: "Tracking number",
    trackingNumberPlaceholder: "e.g. JD014600003456789012",
    carrierLabel: "Carrier (optional)",
    carrierPlaceholder: "DHL, CTT…",
    emailCustomer: "Email the customer with tracking details",
    shippedWithEmail: "Marked as shipped and customer email queued.",
    shippedNoEmail: "Marked as shipped (no email sent).",
    updateFailed: "Update failed",
    updateAndNotify: "Update & notify",
    markShipped: "Mark shipped",

    checkDhl: "Check DHL status",
    checkingDhl: "Checking DHL…",
    checkUpdated: "Updated from DHL.",
    checkCached: "Already up to date (cached).",
    checkFailed: "Check failed",
    carrierUnsupported: "Only DHL parcels can be checked from here",
    refreshBlocked: "Delivered, or checked within the last 6 hours",

    network: "Network error — please try again.",
  },

  common: {
    saving: "Saving…",
    cancel: "Cancel",
    none: "—",
  },
};

export type AdminDict = typeof admin;
export default admin;
