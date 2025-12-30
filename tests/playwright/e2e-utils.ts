import { expect, type Locator, type Page } from "@playwright/test";

const CLICK_TIMEOUT = 30_000;

export type SafeClickOptions = {
  allowBlockingSelectors?: string[];
  allowBodyOverflowHidden?: boolean;
};

export async function ensureNoBlockingOverlay(
  page: Page,
  options: SafeClickOptions = {}
) {
  const { allowBlockingSelectors = [], allowBodyOverflowHidden = false } = options;
  const snapshot = await page.evaluate(
    ({ allowBlockingSelectors }) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const children = Array.from(document.body.children);
      const blocking = children.find((element) => {
        if (element.id === "root") return false;
        if (
          allowBlockingSelectors.some((selector) => selector && element.matches(selector))
        ) {
          return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (style.pointerEvents !== "auto") return false;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        return (
          rect.top <= 0 &&
          rect.left <= 0 &&
          rect.right >= width &&
          rect.bottom >= height
        );
      });
      return {
        blocking: blocking
          ? blocking.getAttribute("data-testid") ??
            blocking.getAttribute("class") ??
            blocking.tagName.toLowerCase()
          : null,
        overflow: document.body.style.overflow,
      };
    },
    { allowBlockingSelectors }
  );
  expect(snapshot.blocking).toBeNull();
  if (!allowBodyOverflowHidden) {
    expect(snapshot.overflow).not.toBe("hidden");
  }
}

export async function safeClick(
  page: Page,
  locator: Locator,
  options: SafeClickOptions = {}
) {
  await expect(locator).toBeVisible({ timeout: CLICK_TIMEOUT });
  await expect(locator).toBeEnabled();
  await ensureNoBlockingOverlay(page, options);
  await locator.click();
}

export async function assertSingleCreateAccountButton(page: Page) {
  const signupButtons = page.getByRole("button", { name: /Créer un compte/i });
  const totalButtons = await signupButtons.count();
  expect(totalButtons).toBeGreaterThan(0);
  let visibleCount = 0;
  for (let index = 0; index < totalButtons; index += 1) {
    const button = signupButtons.nth(index);
    const isVisible = await button.isVisible();
    const display = await button.evaluate((el) =>
      window.getComputedStyle(el).display
    );
    if (isVisible) {
      visibleCount += 1;
    } else {
      expect(display).toBe("none");
    }
  }
  expect(visibleCount).toBe(1);
}
