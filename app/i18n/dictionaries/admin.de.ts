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
    cloudinaryPlaceholder: "https://res.cloudinary.com/…",
    uploading: "Wird hochgeladen…",
    upload: "Hochladen",
    movePhotoUp: (index) => `Foto ${index} nach oben`,
    movePhotoDown: (index) => `Foto ${index} nach unten`,
    remove: "Entfernen",
    addPhoto: "Foto hinzufügen",

    morePhotos: "Gemeinsame Fotos (optional)",
    morePhotosHint: (max) =>
      `Bis zu ${max} Aufnahmen für jede Farbe — Sohle, Karton, Detail. Werden nach den Farbfotos angezeigt. Weglassen, wenn jede Farbe ein volles Shooting hat.`,
    extraPhotoUrl: (index) => `URL für Zusatzfoto ${index}`,

    price: "Preis (EUR)",
    stock: "Bestand",
    variantStockSummary: (total, variants) =>
      `${total} über ${variants} ${variants === 1 ? "Variante" : "Varianten"}`,

    variantsLegend: "Größen, Farben & Fotos",
    variantsIntro:
      "Jedes Produkt wird nach EU-Größe und Farbe verkauft. Farbe anlegen, Größen antippen, dann Preis und Fotos für diese Farbe setzen. Das erste Foto der ersten Farbe erscheint in Warenkorb und Share-Karten.",
    legacySingleSkuHint:
      "Dieser Eintrag stammt noch von vor Größen & Farben. Leg unten eine Farbe und Größen an — wir übernehmen Foto und Preis für die erste Farbe, die du bestückst.",
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
    colourPhotosAndPrices: "Preis & Fotos pro Farbe",
    colourPhotosHint: (max) =>
      `Jede Farbe braucht einen Preis und mindestens ein Foto (bis ${max}). Das erste Foto ist das Hero-Bild; Reihenfolge mit ↑↓.`,
    priceFor: (colour) => `Preis für ${colour}`,
    photoUrlFor: (colour, index) => `${colour} Foto ${index} URL`,
    photoUrlPlaceholder: "https://res.cloudinary.com/…",
    addColourPhoto: (colour) => `Foto für ${colour} hinzufügen`,
    addEmptyRow: "Leere Zeile hinzufügen",

    createProduct: "Produkt anlegen",
    saveChanges: "Änderungen speichern",

    errors: {
      nameRequired: "Name ist erforderlich.",
      descriptionRequired: "Beschreibung ist erforderlich.",
      tooManyPhotos: (max) => `Höchstens ${max} gemeinsame Fotos.`,
      tooManyColourPhotos: (colour, max) =>
        `Höchstens ${max} Fotos für ${colour}.`,
      photoUrlInvalid:
        "Jedes gemeinsame Foto braucht eine Cloudinary-URL (https://…).",
      colourPhotoUrlInvalid: (colour) =>
        `Jedes Foto für ${colour} braucht eine Cloudinary-URL (https://…).`,
      colourPhotoRequired: (colour) =>
        `Füg mindestens ein Foto für ${colour} hinzu.`,
      colourPriceRequired: (colour) =>
        `Gib einen Preis für ${colour} ein.`,
      noVariants: "Füg mindestens eine Größe und Farbe hinzu.",
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

    createLabelTitle: "DHL-Paket-Etikett",
    createLabelHint:
      "Erstellt ein echtes DHL-Etikett für diese Bestellung (Porto kann berechnet werden). Nur Standard-Paket. Die Straße muss eine Hausnummer enthalten.",
    createLabel: "DHL-Etikett erstellen",
    creatingLabel: "Etikett wird erstellt…",
    labelNotConfigured:
      "Parcel-DE-Shipping-Zugangsdaten fehlen. Trag sie in der Umgebung ein, um Ein-Klick-Etiketten zu nutzen.",
    labelStreet: "Straße + Hausnummer",
    labelStreetPlaceholder: "z. B. Schönleinstraße 15",
    labelStreetHint:
      "DHL braucht die Hausnummer. Korrigier sie hier, falls sie fehlt.",
    labelPostal: "PLZ",
    labelCity: "Ort",
    labelWeight: "Gewicht (kg)",
    labelWeightHint: "Die meisten Sneaker ≈ 1 kg; Stiefel oft 1,5–2 kg.",
    labelWeightInvalid: "Gib ein Gewicht zwischen 0,1 und 31,5 kg ein.",
    labelReady: "Etikett bereit",
    downloadLabel: "Etikett herunterladen / drucken (PDF)",
    labelCreatedWithEmail:
      "Etikett erstellt, Bestellung als versendet markiert, E-Mail in der Warteschlange.",
    labelCreatedNoEmail:
      "Etikett erstellt und Bestellung als versendet markiert (keine E-Mail).",
    labelAlreadyExists: "Für diese Bestellung gibt es schon ein Etikett.",
    labelFailed: "Etikett konnte nicht erstellt werden",

    network: "Netzwerkfehler – bitte versuch es erneut.",
  },

  common: {
    saving: "Wird gespeichert…",
    cancel: "Abbrechen",
    none: "—",
  },
};

export default admin;
