/**
 * Who the shop legally is.
 *
 * The same name, address and mailbox appear in the Impressum, in the
 * Widerrufsbelehrung and on the returns page. A customer posting a parcel to a
 * stale address is lost stock plus a refund we still owe, so the copies are
 * derived from this one rather than typed out three times.
 */
export const BUSINESS = {
  name: "Kristiyan Valin",
  street: "Schönleinstraße 15",
  postalCode: "10967",
  city: "Berlin",
  country: "Deutschland",
  email: "kristiyanval@gmail.com",
  /** Display form; use whatsappUrl for the clickable link. */
  whatsapp: "+49 151 56176136",
} as const;

/** wa.me link (digits only, country code included). */
export const BUSINESS_WHATSAPP_URL = "https://wa.me/4915156176136";

/**
 * The postal address as lines, without the country: everything that quotes it
 * is a German page read by a German customer sending a domestic parcel.
 */
export const BUSINESS_ADDRESS_LINES: readonly string[] = [
  BUSINESS.name,
  BUSINESS.street,
  `${BUSINESS.postalCode} ${BUSINESS.city}`,
];

/** The same address on one line, for running text. */
export const BUSINESS_ADDRESS_INLINE = BUSINESS_ADDRESS_LINES.join(", ");
