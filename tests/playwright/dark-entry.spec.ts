import { expect, test } from "@playwright/test";

const consentScript = () => {
  localStorage.setItem("UQ_SKIP_DISCLAIMERS", "1");
  localStorage.setItem("UQ_FORCE_RELOAD_BANNER", "1");
};

test.describe("Dark Entry /jeux", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(consentScript);
  });

  test("shows the PRO teaser when the user is not PRO", async ({ page }) => {
    await page.goto("/jeux");
    await expect(page.getByText(/Dark Entry est réservé aux membres PRO/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Devenir PRO/ })).toBeVisible();
  });

  test("QA preview surfaces the game deck when configured", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("UQ_QA_PRO_PREVIEW", "1");
    });
    await page.goto("/jeux");
    await expect(page.getByRole("heading", { name: "Dark Entry" })).toBeVisible();
    await expect(page.locator(".dark-entry-map")).toBeVisible();
    await expect(page.getByText("Progression")).toBeVisible();
  });

  test("switches from the teaser to the PRO deck when preview mode is enabled", async ({ page }) => {
    await page.goto("/jeux");
    await expect(page.getByText(/Dark Entry est réservé aux membres PRO/)).toBeVisible();
    await page.evaluate(() => {
      localStorage.setItem("UQ_QA_PRO_PREVIEW", "1");
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dark Entry" })).toBeVisible();
    await expect(page.locator(".dark-entry-map")).toBeVisible();
  });
});
