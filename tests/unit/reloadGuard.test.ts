import { test } from "node:test";
import { strict as assert } from "node:assert";
import type { StorageLike } from "../../src/utils/reloadGuard.ts";


process.env.VITE_RELOAD_BANNER_TTL_MS = "500";

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const windowStorage = new MemoryStorage();
(globalThis as any).window = {
  localStorage: windowStorage,
  sessionStorage: new MemoryStorage(),
};

import {
  createReloadGuard,
  ignoreReloadBanner,
  isReloadBannerIgnored,
  shouldShowReloadBanner,
} from "../../src/utils/reloadGuard.ts";

test("auto reload honors max limit and exposes showBanner", () => {
  const storage = new MemoryStorage();
  const session = new MemoryStorage();
  let reloads = 0;
  const guard = createReloadGuard({
    storage,
    sessionStorage: session,
    reload: () => {
      reloads += 1;
    },
    unregisterServiceWorkers: () => Promise.reject(new Error("oops")),
    maxAutoReloads: 2,
  });

  storage.setItem("app_version", "old");
  let status = guard.ensureCleanStorage("new", []);
  assert.strictEqual(status.reloaded, true);
  assert.strictEqual(status.showBanner, false);
  assert.strictEqual(reloads, 1);

  storage.setItem("app_version", "old");
  status = guard.ensureCleanStorage("new", []);
  assert.strictEqual(status.reloaded, true);
  assert.strictEqual(status.showBanner, false);
  assert.strictEqual(reloads, 2);

  storage.setItem("app_version", "old");
  status = guard.ensureCleanStorage("new", []);
  assert.strictEqual(status.reloaded, false);
  assert.strictEqual(status.showBanner, true);

  const guardSnapshot = storage.getItem("uq_reload_guard_v1");
  assert.ok(guardSnapshot);
  const parsed = JSON.parse(guardSnapshot!);
  assert.ok(parsed.n >= 3);
});

test("ignore banner TTL hides and reappears", async () => {
  const storage = new MemoryStorage();
  (globalThis as any).window = {
    localStorage: storage,
    sessionStorage: new MemoryStorage(),
  };
  ignoreReloadBanner(500);
  assert.strictEqual(isReloadBannerIgnored(), true);
  assert.strictEqual(shouldShowReloadBanner(), false);
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.strictEqual(isReloadBannerIgnored(), false);
});

test("storage errors are handled gracefully", () => {
  const storage: StorageLike = {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage failed");
    },
    removeItem: () => {},
    clear: () => {
      throw new Error("can not clear");
    },
  };
  const session: StorageLike = {
    getItem: () => null,
    setItem: () => {
      throw new Error("session failed");
    },
    removeItem: () => {},
    clear: () => {},
  };
  const guard = createReloadGuard({
    storage,
    sessionStorage: session,
    reload: () => {},
    unregisterServiceWorkers: () => Promise.resolve(),
  });
  assert.deepStrictEqual(guard.ensureCleanStorage("v2", []), {
    reloaded: false,
    showBanner: true,
  });
});

test("session storage keeps unrelated keys and sets the version marker", () => {
  const storage = new MemoryStorage();
  const session = new MemoryStorage();
  storage.setItem("app_version", "old");
  session.setItem("keep", "value");
  const guard = createReloadGuard({
    storage,
    sessionStorage: session,
    reload: () => {},
    unregisterServiceWorkers: () => Promise.resolve(),
    maxAutoReloads: 0,
  });
  const status = guard.ensureCleanStorage("new", []);
  assert.strictEqual(session.getItem("keep"), "value");
  assert.strictEqual(session.getItem("app_version_reload"), "new");
  assert.deepStrictEqual(status, {
    reloaded: false,
    showBanner: true,
  });
});

test("unregisterServiceWorkers errors do not break the guard", () => {
  const storage = new MemoryStorage();
  const session = new MemoryStorage();
  storage.setItem("app_version", "old");
  let called = false;
  const guard = createReloadGuard({
    storage,
    sessionStorage: session,
    reload: () => {},
    unregisterServiceWorkers: () => {
      called = true;
      return Promise.reject(new Error("sw fail"));
    },
    maxAutoReloads: 0,
  });
  const status = guard.ensureCleanStorage("new", []);
  assert.strictEqual(called, true);
  assert.deepStrictEqual(status, {
    reloaded: false,
    showBanner: true,
  });
});
