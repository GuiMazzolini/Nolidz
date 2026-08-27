import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    // Node is the default because most of the suite exercises route handlers
    // and pure logic. Component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
    setupFiles: ["app/test/setup.ts"],
    // Starts the one MongoDB the *.integration.test.ts files share.
    globalSetup: ["app/test/global-mongo.ts"],
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
});
