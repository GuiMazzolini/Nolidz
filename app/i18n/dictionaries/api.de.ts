import type { ApiDict } from "./api.en";

/** German API and validation messages, du-form to match the storefront. */
const api: ApiDict = {
  unauthorized: "Nicht autorisiert",
  tooManyRequests: "Zu viele Anfragen. Bitte versuch es später erneut.",
  invalidBody: "Ungültige Anfrage",
  invalidJson: "Ungültiger JSON-Body",

  accountExists: "Mit dieser E-Mail-Adresse existiert bereits ein Konto.",
  accountNotFound: "Konto nicht gefunden",
  invalidResetToken:
    "Dieser Link ist ungültig oder abgelaufen. Fordere einen neuen an.",
  currentPasswordWrong: "Dein aktuelles Passwort ist falsch",
  currentPasswordRequired: "Dein aktuelles Passwort ist erforderlich",
  newPasswordMustDiffer:
    "Das neue Passwort muss sich vom bisherigen unterscheiden",

  productNotFound: "Produkt nicht gefunden",
  productIdTaken: "Ein Produkt mit dieser ID existiert bereits",
  productOrSkuTaken:
    "Ein Produkt oder eine Variante mit dieser ID oder SKU existiert bereits",
  skuTakenByAnotherProduct:
    "Eine dieser SKUs wird bereits von einem anderen Produkt verwendet",

  image: {
    invalid: "Ungültige Bild-URL",
    notAbsolute: "Die Bild-URL muss eine gültige absolute URL sein",
    notHttps: "Die Bild-URL muss https verwenden",
    hostNotAllowed: (hosts) => `Der Host der Bild-URL muss einer von: ${hosts} sein`,
  },

  chooseSizeAndColour: "Wähl eine Größe und eine Farbe",
  outOfStock: "Ausverkauft",
  onlyNInStock: (stock) => `Nur noch ${stock} auf Lager`,
  itemNotInCart: "Artikel nicht im Warenkorb gefunden",

  shippingMethods: {
    standard: "Standardversand (DHL)",
    dpd: "DPD-Versand",
    express: "Expressversand (DHL Express)",
    free: (name) => `${name} — gratis`,
  },

  cartEmpty: "Der Warenkorb ist leer",
  cartTooLarge:
    "Der Warenkorb ist zu groß für den Checkout. Bitte entfern ein paar Artikel.",
  paymentsNotConfigured: "Zahlungen sind nicht eingerichtet. Bitte melde dich bei uns.",
  paymentProviderUnavailable:
    "Der Zahlungsanbieter ist nicht erreichbar. Bitte versuch es erneut.",
  checkoutSessionFailed: "Checkout konnte nicht gestartet werden",

  missingOrderId: "Bestell-ID fehlt",
  orderNotFound: "Bestellung nicht gefunden",
  trackingNumberRequired: "Sendungsnummer ist erforderlich",

  cloudinaryNotConfigured: "Cloudinary ist nicht eingerichtet",
};

export default api;
