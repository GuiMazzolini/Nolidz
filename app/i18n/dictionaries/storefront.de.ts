import type { StorefrontDict } from "./storefront.en";

/**
 * German storefront copy, in the du-form.
 *
 * Register: nolidz writes lowercase, short and direct in English, and the
 * audience for outlet sneakers in DACH is addressed informally by every shop
 * it already buys from. Siezen would read as a different, older brand.
 *
 * Two things stay English on purpose. "nolidz" is the name, and "no lids.
 * just pairs." is the wordmark line under it — a literal "keine deckel. nur
 * paare." reads as a translation of a slogan rather than as a slogan. The
 * sentence under them carries the same meaning in German, which is where the
 * explaining belongs.
 */
const storefront: StorefrontDict = {
  common: {
    shippingArea: "Deutschland",
    brandTagline: "Outlet-Funde. Offene Kartons. Echte Paare.",
    continueShopping: "Weiter shoppen",
    backToHome: "Zurück zur Startseite",
    browseProducts: "Produkte ansehen",
    tryAgain: "Erneut versuchen",
    cancel: "Abbrechen",
    dismiss: "Schließen",
    free: "GRATIS",
    or: "oder",
    optional: "optional",
    loading: "Lädt…",
    saving: "Wird gespeichert…",
    pleaseWait: "Bitte warten…",
    skipToContent: "Zum Inhalt springen",
  },

  nav: {
    women: "Damen",
    men: "Herren",
    kids: "Kinder",
    all: "Alle",
    shopBy: "Kategorien",
    cart: "Warenkorb",
    cartWithCount: (count) => `Warenkorb, ${count} Artikel`,
    logIn: "Anmelden",
    signUp: "Registrieren",
    accountMenu: "Kontomenü",
    account: "Konto",
    orderHistory: "Bestellungen",
    accountSettings: "Kontoeinstellungen",
    admin: "Admin",
    signOut: "Abmelden",
    language: "Sprache",
    switchToGerman: "Auf Deutsch ansehen",
    switchToEnglish: "Auf Englisch ansehen",
  },

  home: {
    metaTitle: "nolidz — Sneaker-Funde aus dem Outlet",
    metaDescription:
      "Einzelpaare aus Outlet-Jagden. Ausgepackt, fotografiert und bereit für die Straße. No lids. Just pairs.",
    ogDescription:
      "Einzelpaare aus Outlet-Jagden. Ausgepackt, fotografiert und bereit für die Straße.",
    eyebrow: "Sneaker-Jagd im Outlet",
    headlineTop: "no lids.",
    headlineBottom: "just pairs.",
    heroBody:
      "Wir wühlen uns durch die Outlet-Bestände, damit du es nicht musst. Einzelpaare, ausgepackt und bereit für die Straße. Was du siehst, ist genau das, was wir rausgeholt haben.",
    shopCta: "Zu den Fundstücken",
    howItWorks: "So läuft's",
    heroImageAlt: "nolidz — Sneaker in einem offenen Karton",
    huntEyebrow: "Die Jagd",
    huntHeading: "Direkt aus dem Outlet",
    huntBody:
      "nolidz ist kein Lager mit endlosen Größen, sondern ein kuratierter Weiterverkauf echter Outlet-Funde – geöffnet, geprüft und Paar für Paar eingestellt.",
    steps: [
      {
        number: "01",
        title: "Jagen",
        description:
          "Wir klappern Outlets und Factory Stores ab und suchen Paare, die den Weiterverkauf wirklich wert sind – keine Restgrößen, die niemand will.",
      },
      {
        number: "02",
        title: "Auspacken",
        description:
          "Jedes Paar kommt aus dem Karton. Keine Deckel, keine Überraschungen. Du siehst die Sneaker, die wir rausgeholt haben, fotografiert so wie sie sind.",
      },
      {
        number: "03",
        title: "Droppen",
        description:
          "Einmal eingestellt, ist es ein Einzelstück. Ist ein Paar weg, ist es weg. Dann beginnt die nächste Jagd.",
      },
    ],
    latestEyebrow: "Neueste Funde",
    latestHeading: "Im Karton",
    viewAll: "Alle Paare ansehen →",
    emptyHeading: "Der erste Drop kommt bald",
    emptyBody:
      "Die nächste Outlet-Jagd läuft bereits. Schau wieder vorbei – für die Paare, die es aus dem Karton schaffen.",
    closingHeading: "Die nächste Jagd läuft schon",
    closingBody:
      "Limitierte Funde. Kein Nachschub. Wenn dich ein Paar anspricht, greif zu, bevor es weg ist.",
    closingCta: "nolidz shoppen",
  },

  catalog: {
    metaTitle: "Produkte",
    metaDescription:
      "Entdecke Sneaker-Funde aus dem Outlet von nolidz – ausgepackt, fotografiert und bereit für die Straße.",
    eyebrow: "Katalog",
    headingAll: "Die Fundstücke",
    countLabel: (shown, total) => `${shown} von ${total} Artikeln`,
    search: "Suche",
    searchPlaceholder: "Name, Farbe oder Beschreibung",
    sort: "Sortieren",
    sortNameAsc: "Name A–Z",
    sortPriceAsc: "Preis: aufsteigend",
    sortPriceDesc: "Preis: absteigend",
    sortStockDesc: "Bestand: absteigend",
    emptyHeading: "Keine Treffer",
    emptyBody:
      "Probier eine andere Kategorie oder einen anderen Suchbegriff – oder setz die Filter zurück.",
    resetFilters: "Filter zurücksetzen",
  },

  productCard: {
    manySizes: "In mehreren Größen verfügbar",
    outOfStockBadge: "Ausverkauft",
    outOfStock: "Ausverkauft",
    chooseSize: "Größe wählen",
    inCartAddSize: (units) => `Im Warenkorb (${units}) · Größe hinzufügen`,
    addToCart: "In den Warenkorb",
    adding: "Wird hinzugefügt…",
    stockLeft: (count) => `Noch ${count}`,
    view: (label) => `${label} ansehen`,
    photoOf: (label, index, total) => `${label} – Foto ${index} von ${total}`,
    previousPhotoOf: (label) => `Vorheriges Foto von ${label}`,
    nextPhotoOf: (label) => `Nächstes Foto von ${label}`,
    soldOutSwatch: (color) => `${color} – ausverkauft`,
    removeFromCart: "Aus dem Warenkorb entfernen",
    decreaseQuantity: "Menge verringern",
    increaseQuantity: "Menge erhöhen",
  },

  productDetail: {
    notFoundTitle: "Produkt nicht gefunden",
    colourLabel: "Farbe:",
    sizeHeadingEu: "EU-Größe",
    sizeHeadingPlain: "Größe",
    chooseSizeHint: "Wähl deine Größe, um das Paar in den Warenkorb zu legen.",
    variantStockTitle: (count) => `${count} verfügbar`,
    description: "Beschreibung",
    addToCart: "In den Warenkorb",
    removeFromCart: "Aus dem Warenkorb entfernen",
    outOfStock: "Ausverkauft",
    selectASize: "Größe wählen",
    buyNow: "Jetzt kaufen",
    processing: "Wird verarbeitet…",
    shipsToOnly: (area) => `Versand nur nach ${area}`,
    shippingRates: "Ab 100 € gratis · sonst 5 €",
    easyReturns: "Einfache Rückgabe",
    returnPolicy: "15 Tage Rückgaberecht",
    inColour: (name, color) => `${name} in ${color}`,
    stock: {
      outOfStockEverySize: "In allen Größen ausverkauft",
      selectSizeForAvailability:
        "Wähl eine Größe, um die Verfügbarkeit zu sehen",
      sizeSoldOut: "Diese Größe ist ausverkauft",
      onlyLeftInSize: (count, size) => `Nur noch ${count} in ${size}`,
      inStockInSize: (count, size) => `${count} auf Lager in ${size}`,
      outOfStock: "Ausverkauft",
      onlyLeft: (count) => `Nur noch ${count}`,
      inStock: (count) => `${count} auf Lager`,
    },
  },

  gallery: {
    photosOf: (alt) => `Fotos von ${alt}`,
    photoOf: (alt, index, total) => `${alt} – Foto ${index} von ${total}`,
    previousPhoto: "Vorheriges Foto",
    nextPhoto: "Nächstes Foto",
    productPhotos: "Produktfotos",
    showPhoto: (index, total) => `Foto ${index} von ${total} anzeigen`,
  },

  shippingBanner: {
    shipToOnly: (area) => `Wir versenden nur nach ${area}.`,
    body: (area) =>
      `Du kannst stöbern und bestellen – beim Checkout brauchen wir aber eine Lieferadresse in ${area}.`,
    dismiss: "Versandhinweis schließen",
  },

  cart: {
    metaTitle: "Warenkorb",
    metaDescription:
      "Prüf die Artikel in deinem Warenkorb, bevor du zur Kasse gehst.",
    eyebrow: "Kasse",
    heading: "Warenkorb",
    emptyHeading: "Dein Warenkorb ist leer",
    emptyBody: "Sieht aus, als hättest du noch nichts hinzugefügt.",
    guestNoticeLead:
      "Du kaufst als Gast – bestellen kannst du auch ohne Konto.",
    guestNoticeLogIn: "Melde dich an",
    guestNoticeTail:
      ", um deinen Warenkorb geräteübergreifend zu speichern und deine Bestellungen einzusehen.",
    orderSummary: "Bestellübersicht",
    subtotal: (items) => `Zwischensumme (${items} Artikel)`,
    shipping: "Versand",
    freeShippingHint: (amount) => `Noch ${amount} bis zum kostenlosen Versand.`,
    total: "Gesamt",
    deliveryOnly: (area) => `Lieferung nur nach ${area}.`,
    deliveryOnlyTail: (area) =>
      `Beim Checkout brauchen wir eine Adresse in ${area}.`,
    payButton: "Mit Karte oder PayPal bezahlen",
    redirecting: "Weiterleitung…",
    secureCheckout: "Sichere Zahlung über Stripe (Karte oder PayPal).",
    secureCheckoutGuest: "Kein Konto nötig – ",
    secureCheckoutTail: "Lieferadresse und E-Mail werden dort erfasst.",
    holdNotice: (minutes) =>
      `Beliebte Größen sind schnell weg – dein Warenkorb reserviert sie nicht. Sobald du zur Zahlung weitergehst, legen wir deine Größe ${minutes} Minuten für dich zurück.`,
    itemAvailable: (count) => `${count} verfügbar`,
    itemOutOfStock: "Ausverkauft",
    eachPrice: (amount) => `(${amount} pro Stück)`,
    removeFromCart: "Aus dem Warenkorb entfernen",
    decreaseQuantity: "Menge verringern",
    increaseQuantity: "Menge erhöhen",
    dismissError: "Fehler ausblenden",
  },

  checkoutSuccess: {
    metaTitle: "Bestellung bestätigt",
    thankYou: "Danke!",
    paymentStatus: "Zahlungsstatus",
    paidBody:
      "Deine Bestellung ist eingegangen. Eine Bestätigung von nolidz ist unterwegs (dazu kommt die Quittung von Stripe).",
    unconfirmedBody:
      "Wir konnten diese Zahlung nicht bestätigen. Falls dir etwas abgebucht wurde, melde dich mit deinen Sitzungsdaten beim Support.",
    noSessionBody: "Geh zurück in den Shop, um einen Kauf abzuschließen.",
    lookUpOrder: "Diese Bestellung nachschlagen",
  },

  orders: {
    metaTitle: "Bestellungen",
    eyebrow: "Konto",
    heading: "Bestellungen",
    intro:
      "Deine bisherigen Käufe. Öffne eine Bestellung für Artikel, Versand und Sendungsverfolgung.",
    emptyHeading: "Noch keine Bestellungen",
    emptyBody:
      "Sobald du einen Kauf abschließt, erscheinen deine Bestellungen hier.",
    startShopping: "Jetzt shoppen",
    viewDetails: "Bestelldetails ansehen →",

    statusShipped: "Versendet",
    statusPaid: "Bezahlt",

    orderPlaced: "Bestellt am",
    total: "Gesamt",
    totalPaid: "Bezahlt",
    subtotal: "Zwischensumme",
    shipping: "Versand",
    shippedTo: "Geliefert an",
    itemQuantity: (quantity) => `× ${quantity}`,

    tracking: "Sendungsverfolgung",
    carrier: (name) => `Versanddienst: ${name}`,
    shippedOn: (date) => `Versendet am ${date}`,
    lastUpdate: (date) => `Letztes Update ${date}`,

    detailMetaTitle: "Bestelldetails",
    detailHeading: "Bestelldetails",
    orderReference: "Bestellreferenz:",
    backToOrders: "← Zurück zu den Bestellungen",
    notFoundHeading: "Bestellung nicht gefunden",
    notFoundBody:
      "Wir konnten keine Bestellung mit diesen Angaben finden. Wenn du als Gast bestellt hast, versuch es über die Gast-Suche mit derselben E-Mail-Adresse, die du beim Checkout verwendet hast.",
    guestLookupCta: "Gast-Bestellsuche",
    backToOrdersPlain: "Zurück zu den Bestellungen",

    lookupMetaTitle: "Gast-Bestellsuche",
    lookupHeading: "Gast-Bestellsuche",
    lookupIntro:
      "Gib die E-Mail-Adresse aus dem Checkout und deine Bestellreferenz (session_id) von der Bestätigungsseite oder aus der Bestätigungsmail ein.",
    lookupEmailLabel: "E-Mail-Adresse aus dem Checkout",
    lookupReferenceLabel: "Bestellreferenz / Session-ID",
    lookupSubmit: "Bestellung suchen",
    lookupNoMatch:
      "Wir konnten keine Bestellung zu dieser E-Mail-Adresse und Referenz finden.",
    lookupViewFull: "Vollständige Bestelldetails ansehen →",
  },

  trackingStatus: {
    preTransit: "Label erstellt – DHL hat es noch nicht gescannt",
    transit: "Unterwegs",
    delivered: "Zugestellt",
    failure: "Problem bei der Zustellung – melde dich bei uns",
    unknown: "Status nicht verfügbar",
  },

  login: {
    metaTitle: "Anmelden",
    metaDescription:
      "Melde dich an oder erstell ein nolidz-Konto, um deinen Warenkorb zu speichern und zu bestellen.",
    titleLogin: "Willkommen zurück",
    titleSignup: "Konto erstellen",
    subtitleLogin:
      "Melde dich an, um deinen Warenkorb zu speichern und zu bestellen.",
    subtitleSignup: "Registrier dich und shoppe mit gespeichertem Warenkorb.",
    tabLogin: "Anmelden",
    tabSignup: "Registrieren",
    nameLabel: "Name",
    namePlaceholder: "Dein Name",
    emailLabel: "E-Mail",
    emailPlaceholder: "du@beispiel.de",
    passwordLabel: "Passwort",
    passwordPlaceholderSignup: "Mindestens 8 Zeichen",
    passwordPlaceholderLogin: "Dein Passwort",
    submitLogin: "Anmelden",
    submitSignup: "Konto erstellen",
    continueWithGitHub: "Weiter mit GitHub",
    continueWithGoogle: "Weiter mit Google",
    continueShopping: "Weiter shoppen",
    withoutAccount: " – auch ohne Konto",
    errorCreateAccount: "Konto konnte nicht erstellt werden.",
    errorInvalidCredentials: "E-Mail-Adresse oder Passwort ist falsch.",
    errorSignupLoginFailed:
      "Konto erstellt, aber die Anmeldung hat nicht geklappt. Melde dich bitte normal an.",
    errorGeneric: "Etwas ist schiefgelaufen. Bitte versuch es erneut.",
  },

  account: {
    metaTitle: "Kontoeinstellungen",
    heading: "Kontoeinstellungen",
    intro: "Verwalte dein Profil, dein Passwort und deine Lieferadresse.",

    profileTitle: "Profil",
    profileDescription:
      "Dieser Name erscheint in der Navigation und in deinen Bestellmails.",
    displayName: "Anzeigename",
    emailLabel: "E-Mail",
    emailLocked:
      "Deine E-Mail-Adresse identifiziert deinen Warenkorb und deine Bestellungen und lässt sich hier nicht ändern. Melde dich beim Support, wenn sie geändert werden soll.",
    saveProfile: "Profil speichern",
    profileUpdated: "Profil aktualisiert.",

    passwordTitle: "Passwort",
    passwordTitleSet: "Passwort festlegen",
    passwordDescription: "Wähl ein neues Passwort mit mindestens 8 Zeichen.",
    passwordDescriptionSet:
      "Du hast dich über ein Social-Konto angemeldet. Mit einem Passwort kannst du dich zusätzlich per E-Mail anmelden – dein Social-Login funktioniert weiterhin.",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    confirmPassword: "Neues Passwort bestätigen",
    changePassword: "Passwort ändern",
    setPassword: "Passwort festlegen",
    passwordChanged: "Passwort geändert.",
    passwordSet: "Passwort festgelegt.",
    passwordsDoNotMatch: "Die neuen Passwörter stimmen nicht überein.",

    addressTitle: "Lieferadresse",
    addressDescription:
      "Nur Deutschland. Wird in deinem Stripe-Kundenprofil gespeichert und beim Checkout vorausgefüllt – ändern kannst du sie dort trotzdem.",
    addressDropped: (area) =>
      `Deine gespeicherte Adresse lag außerhalb von ${area} und wurde entfernt. Bitte gib eine Adresse in ${area} ein.`,
    line1: "Straße und Hausnummer",
    line2: "Adresszusatz",
    city: "Stadt",
    state: "Bundesland",
    postalCode: "Postleitzahl",
    country: "Land",
    countryName: "Deutschland",
    saveAddress: "Adresse speichern",
    removeAddress: "Adresse entfernen",
    addressSaved: "Adresse gespeichert. Sie wird beim Checkout vorausgefüllt.",
    addressRemoved: "Adresse entfernt.",

    deleteTitle: "Konto löschen",
    deleteBody:
      "Löscht dein Konto und deinen gespeicherten Warenkorb endgültig. Vergangene Bestellungen bleiben als Kaufbelege erhalten – du findest sie weiterhin über die Gast-Suche mit deiner E-Mail-Adresse und der Bestellreferenz.",
    deleteCta: "Mein Konto löschen",
    deleteConfirmWord: "LÖSCHEN",
    deleteConfirmBefore: "Tippe ",
    deleteConfirmAfter: " zum Bestätigen",
    deleteConfirm: "Endgültig löschen",
    deleting: "Wird gelöscht…",
    errorCouldNotSave: "Speichern fehlgeschlagen",
    errorCouldNotRemove: "Entfernen fehlgeschlagen",
    errorCouldNotDelete: "Konto konnte nicht gelöscht werden",
    errorGeneric: "Etwas ist schiefgelaufen",
  },

  footer: {
    copyright: (year: number) => `© ${year} Kristiyan Valin`,
    impressum: "Impressum",
    datenschutz: "Datenschutz",
    widerruf: "Widerruf",
  },

  sizeGuide: {
    link: "Größentabelle",
    title: "Größentabelle",
    close: "Schließen",
    note: "Größen sind ungefähre Angaben. Bei Unsicherheit empfehlen wir, eine Größe größer zu wählen.",
    adults: "Erwachsene (EU 36–47)",
    kids: "Kinder (EU 28–35)",
  },

  notFound: {
    metaTitle: "Seite nicht gefunden",
    heading: "Seite nicht gefunden",
    body: "Die Seite, die du suchst, gibt es nicht oder sie wurde verschoben.",
  },

  error: {
    heading: "Etwas ist schiefgelaufen",
    body: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuch es erneut.",
  },
};

export default storefront;
