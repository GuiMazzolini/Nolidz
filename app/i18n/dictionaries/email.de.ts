import type { EmailDict } from "./email.en";

/** German transactional email copy, du-form to match the storefront. */
const email: EmailDict = {
  brand: "nolidz",

  confirmation: {
    subject: (total) => `Deine nolidz-Bestellbestätigung — ${total}`,
    heading: "Danke für deine Bestellung",
    intro:
      "Wir haben deine Zahlung erhalten, deine Bestellung ist bestätigt. Schau jederzeit wieder vorbei.",
    colItem: "Artikel",
    colQuantity: "Menge",
    colTotal: "Summe",
    subtotal: "Zwischensumme",
    shipping: "Versand",
    totalPaid: "Bezahlt",
    shippingTo: "Lieferung an",
    cta: "Weiter shoppen",
  },

  shipped: {
    subject: (carrier) =>
      `Deine nolidz-Bestellung ist unterwegs${carrier ? ` – versendet mit ${carrier}` : ""}`,
    heading: "Deine Bestellung ist unterwegs",
    intro:
      "Gute Nachrichten – wir haben deine Bestellung verschickt. Mit den Sendungsdaten unten kannst du die Lieferung verfolgen.",
    tracking: "Sendungsverfolgung",
    carrier: (name) => `Versanddienst: ${name}`,
    cta: "Bestelldetails ansehen",
  },

  orderReference: (id) => `Bestellreferenz: ${id}`,

  passwordReset: {
    subject: "Setze dein nolidz-Passwort zurück",
    heading: "Passwort zurücksetzen",
    intro:
      "Du hast angefragt, das Passwort für dein nolidz-Konto zurückzusetzen. Der Button unten ist eine Stunde gültig.",
    cta: "Neues Passwort wählen",
    ignore:
      "Wenn du das nicht warst, ignorier die Mail einfach — dein Passwort bleibt unverändert.",
    expiry: "Der Link läuft in einer Stunde ab.",
  },
};

export default email;
