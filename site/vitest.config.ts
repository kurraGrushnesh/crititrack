import { defineConfig } from "vitest/config";

/**
 * The tested layer is `lib/` -- the deterministic logic shared, by
 * necessity, with the Flutter and Node clients. The Next app components
 * are covered by the build and by eslint, not by unit tests.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
