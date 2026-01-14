import { expect, test } from "@playwright/test";

const consentScript = () => {
  localStorage.setItem("UQ_SKIP_DISCLAIMERS", "1");
  localStorage.setItem("UQ_FORCE_RELOAD_BANNER", "1");
};

test.describe("Map core flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(consentScript);
    await page.goto("/carte?skipDisclaimers=1", { waitUntil: "networkidle" });
    await page.getByTestId("map-ready").waitFor({ state: "attached", timeout: 60_000 });
  });

  test("opens a spot popup and toggles filters", async ({ page }) => {
    const pins = page.locator(".uq-pin");
    await expect(pins.first()).toBeVisible({ timeout: 60_000 });
    await pins.first().click();

    const popup = page.getByTestId("spot-popup");
    await expect(popup).toBeVisible({ timeout: 30_000 });

    const epicToggle = page.getByTestId("filter-epic");
    const ghostToggle = page.getByTestId("filter-ghost");
    const filterHint = page.locator(".map-pro-filter-hint");

    await expect(filterHint).toHaveText(/Aucun filtre de tier actif\./i);
    await expect(epicToggle).toHaveAttribute("aria-pressed", "false");
    await expect(ghostToggle).toHaveAttribute("aria-pressed", "false");

    await epicToggle.click();
    await expect(epicToggle).toHaveAttribute("aria-pressed", "true");
    await expect(filterHint).toHaveText(/Filtre uniquement les merveilles EPIC\./i);

    await ghostToggle.click();
    await expect(ghostToggle).toHaveAttribute("aria-pressed", "true");
    await expect(filterHint).toHaveText(/Affiche les spots EPIC et Ghost\./i);
  });
});
