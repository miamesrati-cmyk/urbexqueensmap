import { defineConfig } from "@playwright/test";

const HOST = "127.0.0.1";
const DEFAULT_PORT = process.env.E2E_PORT ?? "4183";
const envBaseUrl = process.env.E2E_BASE_URL?.trim();
const previewUrl = `http://${HOST}:${DEFAULT_PORT}`;
const baseURL = envBaseUrl || previewUrl;

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  ...(envBaseUrl
    ? {}
    : {
        webServer: {
          command: `npm run build && npm run preview -- --host ${HOST} --port ${DEFAULT_PORT} --strictPort`,
          url: previewUrl,
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            VITE_RELOAD_BANNER_TTL_MS: "1000",
            VITE_ENABLE_E2E_HOOKS: "1",
          },
        },
      }),
});
