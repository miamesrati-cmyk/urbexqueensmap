import { expect, test } from "@playwright/test";

const consentScript = () => {
  localStorage.setItem("UQ_SKIP_DISCLAIMERS", "1");
  localStorage.setItem("UQ_FORCE_RELOAD_BANNER", "1");
};

test.use({
  storageState: undefined,
  viewport: { width: 1400, height: 900 },
});

test.describe("QA smoke /carte", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(consentScript);
  });

  test("loads the map and renders pins", async ({ page }) => {
    await page.goto("/carte?skipDisclaimers=1");
    const pins = page.locator(".uq-pin");
    await expect(pins.first()).toBeVisible({ timeout: 30_000 });
  });

  test("search bar handles coordinate lookups", async ({ page }) => {
    await page.goto("/carte?skipDisclaimers=1");
    const searchInput = page.locator("#map-search-input");
    await expect(searchInput).toBeVisible();
    const query = "45.5, -73.6";
    await searchInput.fill(query);
    await searchInput.press("Enter");
    await expect(page.getByText(`${query} (coordonnées)`)).toBeVisible({ timeout: 10_000 });
  });

  test("can add a spot and see its marker", async ({ page }) => {
    await page.goto("/carte?skipDisclaimers=1");
    const addSpotButton = page.getByRole("button", { name: "Ajouter un spot" });
    await expect(addSpotButton).toBeVisible();
    await addSpotButton.click();

    const canvas = page.locator(".mapboxgl-canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await canvas.click({ position: { x: 300, y: 220 } });

    const modalTitle = page.getByRole("heading", { name: "Ajouter un spot" });
    await expect(modalTitle).toBeVisible({ timeout: 10_000 });

    const newSpotTitle = `QA smoke spot ${Date.now()}`;
    await page.locator("input.map-add-input").fill(newSpotTitle);
    await page.locator("textarea.map-add-textarea").fill("Test smoke coverage");
    await page.getByRole("button", { name: "Créer le spot" }).click();

    await expect(page.locator(".map-toast")).toContainText("Spot ajouté", {
      timeout: 20_000,
    });

    const newMarker = page.locator(`.uq-pin[title="${newSpotTitle}"]`);
    await expect(newMarker).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("QA smoke Dark Entry", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(consentScript);
  });

  test("shows the PRO teaser for guests", async ({ page }) => {
    await page.goto("/jeux?skipDisclaimers=1");
    await expect(
      page.getByText(/Dark Entry est réservé aux membres PRO/i)
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Devenir PRO/i })
    ).toBeVisible();
  });

  test("QA preview surfaces the game deck when configured", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("UQ_QA_PRO_PREVIEW", "1");
    });
    await page.goto("/jeux?skipDisclaimers=1");
    await expect(page.getByRole("heading", { name: "Dark Entry" })).toBeVisible();
    await expect(page.locator(".dark-entry-map")).toBeVisible();
  });
});

test.describe("QA smoke admin guard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(consentScript);
  });

  test("admin route renders access denied", async ({ page }) => {
    await page.goto("/admin?skipDisclaimers=1");
    await expect(
      page.getByRole("heading", { name: "Accès refusé" })
    ).toBeVisible();
    await expect(
      page.getByText(/Seuls les admins/i)
    ).toBeVisible();
  });
});
