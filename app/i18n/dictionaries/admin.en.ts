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
    cloudinaryPlaceholder: "https://res.cloudinary.com/…",
    uploading: "Uploading…",
    upload: "Upload",
    movePhotoUp: (index: number) => `Move photo ${index} up`,
    movePhotoDown: (index: number) => `Move photo ${index} down`,
    remove: "Remove",
    addPhoto: "Add photo",

    morePhotos: "Shared photos (optional)",
    morePhotosHint: (max: number) =>
      `Up to ${max} shots shared by every colour — sole, box, detail. Shown after each colour’s own photos. Skip if every colour has a full shoot.`,
    extraPhotoUrl: (index: number) => `Extra photo ${index} URL`,

    price: "Price (EUR)",
    stock: "Stock",
    variantStockSummary: (total: number, variants: number) =>
      `${total} across ${variants} variant${variants === 1 ? "" : "s"}`,

    variantsLegend: "Sizes, colours & photos",
    variantsIntro:
      "Every product is sold by EU size and colour. Add a colour, tap the sizes you stock, then set that colour’s price and photos. The first colour’s first photo is what carts and share cards use.",
    legacySingleSkuHint:
      "This listing predates sizes & colours. Add a colour and sizes below — we’ll reuse the existing photo and price on the first colour you stock.",
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
    colourPhotosAndPrices: "Price & photos per colour",
    colourPhotosHint: (max: number) =>
      `Each colour needs a price and at least one photo (up to ${max}). The first photo is the hero shoppers see; reorder with ↑↓.`,
    priceFor: (colour: string) => `Price for ${colour}`,
    photoUrlFor: (colour: string, index: number) =>
      `${colour} photo ${index} URL`,
    photoUrlPlaceholder: "https://res.cloudinary.com/…",
    addColourPhoto: (colour: string) => `Add photo for ${colour}`,
    addEmptyRow: "Add empty row",

    createProduct: "Create product",
    saveChanges: "Save changes",

    errors: {
      nameRequired: "Name is required.",
      descriptionRequired: "Description is required.",
      tooManyPhotos: (max: number) => `At most ${max} shared photos.`,
      tooManyColourPhotos: (colour: string, max: number) =>
        `At most ${max} photos for ${colour}.`,
      photoUrlInvalid: "Each shared photo needs a Cloudinary URL (https://…).",
      colourPhotoUrlInvalid: (colour: string) =>
        `Each photo for ${colour} needs a Cloudinary URL (https://…).`,
      colourPhotoRequired: (colour: string) =>
        `Add at least one photo for ${colour}.`,
      colourPriceRequired: (colour: string) =>
        `Enter a price for ${colour}.`,
      noVariants: "Add at least one size and colour.",
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
      return `${count}${waiting}. After you ship the parcel, add the tracking number below.`;
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
    carrierStatusPrefix: (carrier: string) => `${carrier}:`,
    checkedAt: (date: string) => `Checked ${date}`,

    shipFormUpdate: "Update shipment",
    shipFormCreate: "Mark as shipped",
    shipFormHint:
      "After you drop the parcel off, paste the tracking number here. The carrier is prefilled from the delivery the customer paid for — change it if you shipped another way.",
    trackingNumberLabel: "Tracking number",
    trackingNumberPlaceholder: "e.g. JD014600003456789012",
    carrierLabel: "Carrier (optional)",
    carrierPlaceholder: "DHL, DPD…",
    emailCustomer: "Email the customer with tracking details",
    shippedWithEmail: "Marked as shipped and customer email queued.",
    shippedNoEmail: "Marked as shipped (no email sent).",
    updateFailed: "Update failed",
    updateAndNotify: "Update & notify",
    markShipped: "Mark shipped",

    checkStatus: "Check carrier status",
    checkingStatus: "Checking…",
    checkUpdated: "Updated from the carrier.",
    checkCached: "Already up to date (cached).",
    checkFailed: "Check failed",
    carrierUnsupported:
      "We cannot check this carrier from here — track it on the carrier's own site",
    refreshBlocked: "Delivered, or checked within the last 6 hours",

    createLabelTitle: "DHL Paket label",
    createLabelHint:
      "Creates a real DHL label for this order (postage may be charged). Only for standard Paket — Express stays manual below. Check the street includes a house number.",
    createLabel: "Create DHL label",
    creatingLabel: "Creating label…",
    labelNotConfigured:
      "Parcel DE Shipping credentials are not set. Add them in the environment to enable one-click labels.",
    labelStreet: "Street + house number",
    labelStreetPlaceholder: "e.g. Schönleinstraße 15",
    labelStreetHint:
      "DHL needs the house number. Fix it here if the customer left it out.",
    labelPostal: "Postcode",
    labelCity: "City",
    labelReady: "Label ready",
    downloadLabel: "Download / print label (PDF)",
    labelCreatedWithEmail: "Label created, order marked shipped, customer email queued.",
    labelCreatedNoEmail: "Label created and order marked shipped (no email sent).",
    labelAlreadyExists: "This order already has a label.",
    labelFailed: "Could not create the label",

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
