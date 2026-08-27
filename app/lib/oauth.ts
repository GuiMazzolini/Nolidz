/**
 * Google sign-in is optional: a checkout can run entirely on email and
 * password, and a contributor without Google Cloud credentials should still
 * get a working login page. Both halves of the credential pair have to be
 * present — a client id with no secret fails at the token exchange, which is
 * far enough into the redirect that the user has already left the site.
 *
 * The provider list and the login page both gate on this, so the button only
 * appears when the redirect behind it can actually complete.
 */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ID?.trim() && process.env.GOOGLE_SECRET?.trim());
}
