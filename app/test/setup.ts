import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Component tests opt into jsdom per file; in the node-environment files there
// is no DOM to tear down.
afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});
