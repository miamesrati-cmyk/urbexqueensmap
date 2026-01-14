import { expect, test, type Page } from "@playwright/test";

const consentScript = () => {
  localStorage.setItem("UQ_SKIP_DISCLAIMERS", "1");
  localStorage.setItem("UQ_FORCE_RELOAD_BANNER", "1");
};

test.describe("App load checks", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(consentScript);
  });

  async function ensureNoBoundary(page: Page) {
    await expect(page.locator("text=Une erreur est survenue. Veuillez réessayer.")).toHaveCount(0);
  }

  test("home page renders without an error boundary", async ({ page }) => {
    await page.goto("/?skipDisclaimers=1", { waitUntil: "networkidle" });
    await ensureNoBoundary(page);
  });

  test("map page renders without an error boundary", async ({ page }) => {
    await page.goto("/carte?skipDisclaimers=1", { waitUntil: "networkidle" });
    await page.getByTestId("map-ready").waitFor({ state: "attached", timeout: 60_000 });
    await ensureNoBoundary(page);
  });
});
