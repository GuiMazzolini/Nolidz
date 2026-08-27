import type { TestProject } from "vitest/node";

/**
 * One MongoDB for the whole test run, started before any file imports.
 *
 * Each integration file used to start its own, which was fine while there were
 * a handful: six of them on one machine starve each other, and the first test
 * to touch bcrypt or an index build times out on a laptop that is merely busy
 * rather than broken. They share a server now and keep a database each —
 * `useTestDatabase` still names them `nolidz_test_<suite>` — so nothing they
 * assert about isolation changes.
 *
 * Failure here is not fatal: a machine with no network on its first run cannot
 * download the binary, and the integration files skip rather than fail. That
 * is why the uri is provided as null instead of thrown.
 */
export default async function setup(project: TestProject) {
  // CI points this at its service container, which needs no server of ours.
  const configured = process.env.TEST_MONGODB_URI;
  if (configured) {
    project.provide("mongoUri", configured);
    return;
  }

  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create();
    project.provide("mongoUri", server.getUri());
    return async () => {
      await server.stop();
    };
  } catch (err) {
    console.warn(
      "Integration tests skipped: could not start a MongoDB.",
      err instanceof Error ? err.message : err
    );
    project.provide("mongoUri", null);
  }
}

declare module "vitest" {
  export interface ProvidedContext {
    /** The server the integration files connect to, or null if there is none. */
    mongoUri: string | null;
  }
}
