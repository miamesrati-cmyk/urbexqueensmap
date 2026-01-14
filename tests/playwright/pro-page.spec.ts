import { expect, test } from "@playwright/test";

const consentScript = () => {
  localStorage.setItem("UQ_SKIP_DISCLAIMERS", "1");
  localStorage.setItem("UQ_FORCE_RELOAD_BANNER", "1");
};

test.describe("Pro landing", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(consentScript);
  });

  test("shows Débloquer PRO CTA", async ({ page }) => {
    await page.goto("/pro?skipDisclaimers=1", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Débloquer PRO/i })).toBeVisible({ timeout: 15_000 });
  });
});
