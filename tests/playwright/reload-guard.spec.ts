import { expect, test } from "@playwright/test";
import { ensureNoBlockingOverlay, safeClick } from "./e2e-utils";

test.describe("Reload guard + banner", () => {
  test("limits auto reloads, surfaces banner and respects ignore TTL", async ({ page }) => {
    await page.context().addInitScript(() => {
      const now = Date.now();
      try {
        window.localStorage.clear();
      } catch {
        // ignore storage issues
      }
      window.localStorage.setItem("app_version", "old-version");
      window.localStorage.setItem("uq_reload_guard_v1", JSON.stringify({ t: now, n: 2 }));
      window.localStorage.setItem("urbexqueens_legalConsent_v1", "accepted");
      const originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === "app_version") {
          throw new Error("storage write blocked");
        }
        return originalSet.call(this, key, value);
      };
    });

    await page.addInitScript(() => {
      localStorage.setItem("UQ_FORCE_RELOAD_BANNER", "1");
      localStorage.setItem("UQ_SKIP_DISCLAIMERS", "1");
    });
    await page.goto("/?skipDisclaimers=1&qaReload=1&forceReloadBanner=1");
    await page.evaluate(() => {
      (window as any).__UQ_QA?.triggerReloadBanner?.();
    });

    const banner = page.getByTestId("reload-banner");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await ensureNoBlockingOverlay(page);
    await expect(page.getByRole("button", { name: "Recharger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ignorer" })).toBeVisible();

    await safeClick(page, page.getByRole("button", { name: "Ignorer" }));
    await expect(banner).toBeHidden();
    await ensureNoBlockingOverlay(page);
    await page.waitForTimeout(1_200);
    await expect(banner).toBeVisible();

    const guardValue = await page.evaluate(() => localStorage.getItem("uq_reload_guard_v1"));
    expect(guardValue).not.toBeNull();
    const guard = JSON.parse(guardValue as string);
    expect(guard.n).toBeGreaterThan(2);
  });
});
