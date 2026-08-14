/**
 * The signed-in user for the current test. Route handlers call
 * `getServerSession`, which test files mock through to `getMockSession`.
 */

type MockSession = {
  user: { email?: string | null; name?: string | null; isAdmin?: boolean };
} | null;

let currentSession: MockSession = null;

export function setMockSession(email: string | null, name = "Test User") {
  currentSession = email ? { user: { email, name } } : null;
}

/** A session object with a user but no email — a real OAuth edge case. */
export function setEmaillessSession() {
  currentSession = { user: { name: "No Email" } };
}

export function getMockSession(): MockSession {
  return currentSession;
}

export function clearMockSession() {
  currentSession = null;
}
