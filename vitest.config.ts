import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/firestore/**/*.test.ts"],
    exclude: ["tests/playwright/**"],
  },
});
