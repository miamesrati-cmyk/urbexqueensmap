import { expect, test } from "@playwright/test";

const consentScript = () => {
  localStorage.setItem("UQ_SKIP_DISCLAIMERS", "1");
  localStorage.setItem("UQ_FORCE_RELOAD_BANNER", "1");
};

test.describe("Admin gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(consentScript);
  });

  test("denies access for guests", async ({ page }) => {
    await page.goto("/admin?skipDisclaimers=1", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
    await expect(page.getByText(/Seuls les admins/i)).toBeVisible();
  });
});
