import { expect, test } from "@playwright/test";
import {
  assertSingleCreateAccountButton,
  ensureNoBlockingOverlay,
  safeClick,
} from "./e2e-utils";

test.use({
  storageState: undefined,
  viewport: { width: 1400, height: 900 },
});

test.describe("Map guard smoke", () => {
  test("marks two spots, verifies pins stay and lists persist", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("UQ_FORCE_RELOAD_BANNER", "1");
      localStorage.setItem("UQ_SKIP_DISCLAIMERS", "1");
    });
    await page.context().clearCookies();
    await page.context().clearPermissions();
    await page.goto("/?skipDisclaimers=1&qaReload=1&openAuth=signup&forceReloadBanner=1");
    await page.evaluate(() => {
      (window as any).__UQ_QA?.logout?.();
      (window as any).__UQ_QA?.triggerReloadBanner?.();
    });

    await assertSingleCreateAccountButton(page);

    const modal = page.getByRole("dialog", {
      name: /Inscription|Créer un compte/i,
    });
    await expect(modal).toBeVisible({ timeout: 15_000 });

    const nonce = Math.random().toString(36).slice(2, 8);
    const email = `playwright-${Date.now()}-${nonce}@urbexqueens.app`;
    const password = `P@ssw0rd-${Math.floor(Math.random() * 100000)}`;

    const switchSignup = modal.getByTestId("auth-switch-signup");
    if (await switchSignup.count()) {
      await safeClick(page, switchSignup, {
        allowBlockingSelectors: [".auth-modal-backdrop"],
        allowBodyOverflowHidden: true,
      });
    }
    await expect(modal.getByTestId("auth-username")).toBeVisible();
    await modal.getByTestId("auth-username").fill(`Tester ${nonce}`);
    await modal.getByTestId("auth-email").fill(email);
    await modal.getByTestId("auth-password").fill(password);
    await safeClick(page, modal.getByTestId("auth-submit"), {
      allowBlockingSelectors: [".auth-modal-backdrop"],
      allowBodyOverflowHidden: true,
    });

    await expect(modal).toBeHidden({ timeout: 30_000 });
    await ensureNoBlockingOverlay(page);

    const pins = page.locator(".uq-pin");
    await expect(pins.first()).toBeVisible({ timeout: 30_000 });
    await expect(pins.nth(1)).toBeVisible({ timeout: 30_000 });

    await safeClick(page, pins.first());
    const doneButton = page.locator(".uq-spot-popup .urbex-done-btn").first();
    await safeClick(page, doneButton);
    await expect(doneButton).toContainText("Déjà fait", {
      timeout: 30_000,
    });
    await expect(doneButton).toBeEnabled({ timeout: 30_000 });

    await safeClick(page, pins.nth(1));
    const saveButton = page.locator(".uq-spot-popup .urbex-save-btn").first();
    await safeClick(page, saveButton);
    await expect(saveButton).toContainText("Ajouté", {
      timeout: 30_000,
    });
    await expect(saveButton).toBeEnabled({ timeout: 30_000 });

    const avatarTrigger = page.getByRole("button", { name: "Compte" }).first();
    await safeClick(page, avatarTrigger);

    const doneMenuItem = page.getByRole("button", { name: /Spots faits/i }).first();
    await expect(
      doneMenuItem.locator(".topbar-dropdown-item-count")
    ).toHaveText("1");
    await safeClick(page, doneMenuItem);

    const doneModal = page.locator(".spot-lists-modal-backdrop");
    await expect(doneModal).toContainText("Faits · 1");
    await safeClick(
      page,
      doneModal.getByRole("button", { name: "Fermer" }).first(),
      {
        allowBlockingSelectors: [".spot-lists-modal-backdrop"],
      }
    );
    await ensureNoBlockingOverlay(page);

    await safeClick(page, avatarTrigger);
    const favMenuItem = page.getByRole("button", { name: /Favoris/i }).first();
    await expect(
      favMenuItem.locator(".topbar-dropdown-item-count")
    ).toHaveText("1");
    await safeClick(page, favMenuItem);

    const favModal = page.locator(".spot-lists-modal-backdrop");
    await expect(favModal).toContainText("Favoris · 1");
    await safeClick(
      page,
      favModal.getByRole("button", { name: "Fermer" }).first(),
      {
        allowBlockingSelectors: [".spot-lists-modal-backdrop"],
      }
    );
    await ensureNoBlockingOverlay(page);

    await page.reload();
    const avatarTriggerAfterReload = page
      .getByRole("button", { name: "Compte" })
      .first();
    await safeClick(page, avatarTriggerAfterReload);

    const doneMenuAfterReload = page
      .getByRole("button", { name: /Spots faits/i })
      .first();
    await expect(
      doneMenuAfterReload.locator(".topbar-dropdown-item-count")
    ).toHaveText("1");
    await safeClick(page, doneMenuAfterReload);
    await expect(doneModal).toContainText("Faits · 1");
    await safeClick(
      page,
      doneModal.getByRole("button", { name: "Fermer" }).first(),
      {
        allowBlockingSelectors: [".spot-lists-modal-backdrop"],
      }
    );
    await ensureNoBlockingOverlay(page);

    await safeClick(page, avatarTriggerAfterReload);
    const favMenuAfterReload = page
      .getByRole("button", { name: /Favoris/i })
      .first();
    await expect(
      favMenuAfterReload.locator(".topbar-dropdown-item-count")
    ).toHaveText("1");
    await safeClick(page, favMenuAfterReload);
    await expect(favModal).toContainText("Favoris · 1");
    await safeClick(
      page,
      favModal.getByRole("button", { name: "Fermer" }).first(),
      {
        allowBlockingSelectors: [".spot-lists-modal-backdrop"],
      }
    );
    await ensureNoBlockingOverlay(page);
  });
});
