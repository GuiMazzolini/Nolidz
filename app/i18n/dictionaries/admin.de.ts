import type { AdminDict } from "./admin.en";

/** German admin copy, du-form to match the storefront. */
const admin: AdminDict = {
  nav: {
    eyebrow: "Admin",
    title: "Shop-Verwaltung",
    orders: "Bestellungen",
    products: "Produkte",
    addProduct: "Produkt anlegen",
  },

  products: {
    metaTitle: "Admin — Produkte",
    metaTitleNew: "Admin — Neues Produkt",
    metaTitleEdit: "Admin — Produkt bearbeiten",
    eyebrow: "Katalog",
    heading: "Produkte",
    intro: "Verwalte Lagerbestand, Preise und Produktbilder.",
    addHeading: "Produkt anlegen",
    editHeading: (name) => `${name} bearbeiten`,

    attentionHeading: "Bestand braucht Aufmerksamkeit",
    attentionBody: (outOfStock, lowStock, threshold) => {
      const parts: string[] = [];
      if (outOfStock > 0) parts.push(`${outOfStock} ausverkauft`);
      if (lowStock > 0)
        parts.push(`${lowStock} mit wenig Bestand (≤ ${threshold})`);
      return `${parts.join(" · ")}. Nutz die Filter unten, um sie durchzugehen.`;
    },

    search: "Suche",
    searchPlaceholder: "Name oder ID",
    stockFilter: "Bestandsfilter",
    filterAll: "Alle Produkte",
    filterHealthy: "Ausreichend Bestand",
    filterLow: "Wenig Bestand",
    filterOut: "Ausverkauft",
    sort: "Sortieren",
    sortNameAsc: "Name A–Z",
    sortPriceAsc: "Preis: aufsteigend",
    sortPriceDesc: "Preis: absteigend",
    sortStockAsc: "Bestand: aufsteigend",
    showingCount: (shown, total) => `${shown} von ${total} Produkten`,

    colProduct: "Produkt",
    colCategory: "Kategorie",
    colPrice: "Preis",
    colStock: "Bestand",
    colActions: "Aktionen",
    noMatches: "Keine Produkte passen zu diesen Filtern.",
    stockOutSuffix: " · Leer",
    stockLowSuffix: " · Wenig",
    variantSummary: (inStock, total, soldOut) => {
      const base = `${inStock} von ${total} Kombinationen auf Lager`;
      return soldOut > 0 ? `${base} · ${soldOut} ausverkauft` : base;
    },
    heldInCheckout: (count) => `${count} im Checkout reserviert`,
    edit: "Bearbeiten",
    delete: "Löschen",
    deleteConfirm: (name) =>
      `„${name}“ löschen? Das lässt sich nicht rückgängig machen.`,
    deleteFailed: "Löschen fehlgeschlagen",
  },

  form: {
    name: "Name",
    idOptional: "ID (optional)",
    idPlaceholder: "Wird aus dem Namen erzeugt, wenn leer",
    category: "Kategorie",
    description: "Beschreibung",
    productImage: "Produktbild",
    cloudinaryPlaceholder: "https://res.cloudinary.com/…",
    uploading: "Wird hochgeladen…",
    uploadImage: "Bild hochladen",
    uploadHint: "Zu Cloudinary hochladen oder eine Cloudinary-URL einfügen.",
    productPreview: "Produktvorschau",
    imagePreview: "Bildvorschau",
    previewBroken: "Dieses Bild ließ sich nicht laden – prüf die URL.",
    noImageYet: "Noch kein Bild – lade eines hoch, um eine Vorschau zu sehen",

    morePhotos: "Weitere Fotos",
    morePhotosHint: (max) =>
      `Bis zu ${max} weitere Aufnahmen – Seitenansicht, Dreiviertel, Sohle, Detail. Werden nach dem Hauptbild in dieser Reihenfolge angezeigt.`,
    extraPhotoUrl: (index) => `URL für Zusatzfoto ${index}`,
    upload: "Hochladen",
    movePhotoUp: (index) => `Foto ${index} nach oben`,
    movePhotoDown: (index) => `Foto ${index} nach unten`,
    remove: "Entfernen",
    addPhoto: "Foto hinzufügen",

    price: "Preis (EUR)",
    priceFallbackHint:
      "Fallback für jede Farbe, die unten keinen eigenen Preis hat.",
    stock: "Bestand",
    variantStockSummary: (total, variants) =>
      `${total} über ${variants} ${variants === 1 ? "Variante" : "Varianten"}`,

    variantsLegend: "Größen & Farben",
    useVariants: "Dieses Produkt nach EU-Größe und Farbe verkaufen",
    useVariantsHint:
      "Jede Kombination aus Größe und Farbe bekommt eine eigene SKU und einen eigenen Bestand. Größen gelten pro Farbe – Schwarz kann 42 führen, Weiß nicht. Der Preis gilt ebenfalls pro Farbe. Ausgeschaltet wird eine einzelne SKU verkauft.",
    addSizeRun: "Größenlauf hinzufügen",
    addSizeRunHint:
      "Fügt Größen nur für diese Farbe hinzu. Weiß kann 46 auslassen, auch wenn Schwarz sie führt.",
    colour: "Farbe",
    colourPlaceholder: "z. B. Schwarz",
    stockPerSize: "Bestand pro Größe",
    tapSizeHint:
      "Tipp eine Größe an, um sie für diese Farbe hinzuzufügen; nochmal tippen entfernt sie.",
    enterColourFirst:
      "Gib zuerst eine Farbe ein, dann tipp die Größen an, die du führst.",
    euSize: "EU-Größe",
    euSizeForRow: (index) => `EU-Größe für Zeile ${index}`,
    colourForRow: (index) => `Farbe für Zeile ${index}`,
    stockForRow: (index) => `Bestand für Zeile ${index}`,
    colourPhotosAndPrices: "Farbfotos und Preise",
    colourPhotosHint:
      "Der Preis gilt pro Farbe – eine limitierte Auflage kann mehr kosten als die Standardfarbe. Lass den Preis leer, um den Standardpreis von oben zu übernehmen. Lass das Foto leer, um auf das Hauptbild zurückzufallen.",
    priceFor: (colour) => `Preis für ${colour}`,
    photoUrlFor: (colour) => `Foto-URL für ${colour}`,
    photoUrlPlaceholder: "https://res.cloudinary.com/… (optional)",
    addEmptyRow: "Leere Zeile hinzufügen",

    createProduct: "Produkt anlegen",
    saveChanges: "Änderungen speichern",

    errors: {
      nameRequired: "Name ist erforderlich.",
      descriptionRequired: "Beschreibung ist erforderlich.",
      imageUrlInvalid:
        "Lade ein Bild hoch oder füg eine Cloudinary-URL ein (https://…).",
      priceInvalid: "Gib einen gültigen, nicht negativen Preis ein.",
      stockInvalid: "Der Bestand muss eine ganze Zahl ≥ 0 sein.",
      tooManyPhotos: (max) => `Höchstens ${max} zusätzliche Fotos.`,
      photoUrlInvalid:
        "Jedes zusätzliche Foto braucht eine Cloudinary-URL (https://…).",
      noVariants:
        "Füg mindestens eine Größe/Farbe hinzu oder schalte Varianten aus.",
      tooManyVariants: (max) => `Höchstens ${max} Varianten.`,
      variantNeedsSize: "Jede Variante braucht eine EU-Größe.",
      variantNeedsColour: "Jede Variante braucht eine Farbe.",
      variantStockInvalid: (size, colour) =>
        `Der Bestand für EU ${size} / ${colour} muss eine ganze Zahl ≥ 0 sein.`,
      variantDuplicate: (size, colour) =>
        `EU ${size} / ${colour} ist doppelt aufgeführt.`,
      colourPriceInvalid: (colour) =>
        `Der Preis für ${colour} muss eine gültige, nicht negative Zahl sein.`,
      uploadStartFailed: "Bild-Upload konnte nicht gestartet werden",
      uploadFailed: "Bild-Upload fehlgeschlagen. Versuch eine andere Datei.",
      uploadNetwork:
        "Bild-Upload fehlgeschlagen. Prüf deine Verbindung und versuch es erneut.",
      fixHighlighted:
        "Bitte korrigier die markierten Felder, bevor du speicherst.",
      saveFailed: "Speichern fehlgeschlagen",
      network: "Netzwerkfehler – bitte versuch es erneut.",
    },
  },

  orders: {
    metaTitle: "Admin — Bestellungen",
    eyebrow: "Versand",
    heading: "Bestellungen",
    summary: (total, awaiting) => {
      const count = `${total} ${total === 1 ? "Bestellung" : "Bestellungen"}`;
      const waiting = awaiting > 0 ? ` · ${awaiting} warten auf Versand` : "";
      return `${count}${waiting}. Sobald du das Paket verschickt hast, trag unten die Sendungsnummer ein.`;
    },
    empty:
      "Noch keine Bestellungen. Schließ einen Testkauf ab, um den Versand hier zu sehen.",
    statusShipped: "Versendet",
    statusPaid: "Bezahlt – packen & verschicken",
    customerView: "Kundenansicht",
    items: "Artikel",
    shipTo: "Versand an",
    trackingNumber: (value) => `Sendungsnummer: ${value}`,
    carrier: (name) => `Versanddienst: ${name}`,
    markedShipped: (date) => `Als versendet markiert am ${date}`,
    carrierStatusPrefix: (carrier) => `${carrier}:`,
    checkedAt: (date) => `Geprüft am ${date}`,

    shipFormUpdate: "Versand aktualisieren",
    shipFormCreate: "Als versendet markieren",
    shipFormHint:
      "Sobald du das Paket abgegeben hast, trag hier die Sendungsnummer ein. Der Versanddienst ist mit dem vorbelegt, den die Kundschaft bezahlt hat — änder ihn, falls du anders verschickt hast.",
    trackingNumberLabel: "Sendungsnummer",
    trackingNumberPlaceholder: "z. B. JD014600003456789012",
    carrierLabel: "Versanddienst (optional)",
    carrierPlaceholder: "DHL, DPD…",
    emailCustomer: "Kundschaft per E-Mail über die Sendung informieren",
    shippedWithEmail:
      "Als versendet markiert, E-Mail an die Kundschaft ist in der Warteschlange.",
    shippedNoEmail: "Als versendet markiert (keine E-Mail verschickt).",
    updateFailed: "Aktualisierung fehlgeschlagen",
    updateAndNotify: "Aktualisieren & benachrichtigen",
    markShipped: "Als versendet markieren",

    checkStatus: "Sendungsstatus abfragen",
    checkingStatus: "Wird abgefragt…",
    checkUpdated: "Vom Versanddienst aktualisiert.",
    checkCached: "Bereits aktuell (aus dem Cache).",
    checkFailed: "Abfrage fehlgeschlagen",
    carrierUnsupported:
      "Diesen Versanddienst können wir von hier nicht abfragen — verfolg die Sendung auf dessen eigener Seite",
    refreshBlocked: "Zugestellt oder in den letzten 6 Stunden bereits abgefragt",

    network: "Netzwerkfehler – bitte versuch es erneut.",
  },

  common: {
    saving: "Wird gespeichert…",
    cancel: "Abbrechen",
    none: "—",
  },
};

export default admin;
