import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "./storage.ts";
import { ensureQaGlobal } from "./qaTools.ts";

const RELOAD_GUARD_KEY = "uq_reload_guard_v1";
const RELOAD_BANNER_FLAG = "__UQ_RELOAD_BANNER__";
const RELOAD_BANNER_IGNORE_KEY = "__UQ_RELOAD_BANNER_IGNORE_AT__";
const DEFAULT_RELOAD_BANNER_IGNORE_TTL = 10 * 60 * 1000;
const importMetaEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
const RELOAD_BANNER_IGNORE_TTL =
  Number(importMetaEnv?.VITE_RELOAD_BANNER_TTL_MS ?? "") || DEFAULT_RELOAD_BANNER_IGNORE_TTL;
const QA_RELOAD_PARAM = "qaReload";
export const QA_TRIGGER_EVENT = "__UQ_RELOAD_BANNER_TRIGGER__";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

function readItem(adapter: StorageLike, key: string): string | null {
  try {
    return adapter.getItem(key);
  } catch (error) {
    console.error("Storage read failed", key, error);
    return null;
  }
}

function writeItem(adapter: StorageLike, key: string, value: string): boolean {
  try {
    adapter.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Storage write failed", key, error);
    return false;
  }
}

function clearStorage(adapter: StorageLike): boolean {
  try {
    adapter.clear();
    return true;
  } catch (error) {
    console.error("Storage clear failed", error);
    return false;
  }
}

export type ReloadGuardOptions = {
  storage: StorageLike;
  sessionStorage: StorageLike;
  now?: () => number;
  reload: () => void;
  unregisterServiceWorkers?: () => Promise<void>;
  maxAutoReloads?: number;
};

export type CleanStatus = {
  reloaded: boolean;
  showBanner: boolean;
};

export function createReloadGuard(options: ReloadGuardOptions) {
  const {
    storage,
    sessionStorage,
    now = () => Date.now(),
    reload,
    unregisterServiceWorkers,
    maxAutoReloads = 2,
  } = options;

  function canAutoReload(): boolean {
    const raw = readItem(storage, RELOAD_GUARD_KEY);
    const current = now();
    let data = { t: 0, n: 0 };
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { t: 0, n: 0 };
      }
    }
    const within30s = current - data.t < 30_000;
    const n = within30s ? data.n + 1 : 1;
    const success = writeItem(storage, RELOAD_GUARD_KEY, JSON.stringify({ t: current, n }));
    if (!success) {
      return false;
    }
    return n <= maxAutoReloads;
  }

  function ensureCleanStorage(appVersion: string, keepKeys: string[]): CleanStatus {
    const storedVersion = readItem(storage, "app_version");
    if (storedVersion === appVersion) {
      return { reloaded: false, showBanner: false };
    }

    const logStatus = (action: string) => {
      if (!import.meta.env?.DEV) return;
      console.info("[UQ] ensureCleanStorage", {
        from: storedVersion,
        to: appVersion,
        action,
      });
    };

    const preserved: Record<string, string> = {};
    keepKeys.forEach((key) => {
      const value = readItem(storage, key);
      if (value !== null) {
        preserved[key] = value;
      }
    });

    let persistenceFailed = false;
    const shouldReload = canAutoReload();
    const guardSnapshot = readItem(storage, RELOAD_GUARD_KEY);
    if (!clearStorage(storage)) {
      persistenceFailed = true;
    }

    if (!writeItem(storage, "app_version", appVersion)) {
      persistenceFailed = true;
    }
    writeItem(sessionStorage, "app_version_reload", appVersion);
    if (!writeItem(sessionStorage, "app_version_reload", appVersion)) {
      persistenceFailed = true;
    }
    if (guardSnapshot !== null) {
      if (!writeItem(storage, RELOAD_GUARD_KEY, guardSnapshot)) {
        persistenceFailed = true;
      }
    }

    Object.entries(preserved).forEach(([key, value]) => {
      if (!writeItem(storage, key, value)) {
        persistenceFailed = true;
      }
    });

    if (unregisterServiceWorkers) {
      unregisterServiceWorkers().catch((err) =>
        console.error("Failed to unregister SW", err)
      );
    }

    if (shouldReload && !persistenceFailed) {
      logStatus("reload");
      reload();
      return { reloaded: true, showBanner: false };
    }

    logStatus("banner");
    return { reloaded: false, showBanner: true };
  }

  return {
    ensureCleanStorage,
  };
}

function readIgnoreExpiry(): number | null {
  if (typeof window === "undefined") return null;
  const raw = safeLocalStorageGet(RELOAD_BANNER_IGNORE_KEY);
  if (!raw) return null;
  const expiry = Number(raw);
  if (!Number.isFinite(expiry)) {
    return null;
  }
  if (Date.now() > expiry) {
    safeLocalStorageRemove(RELOAD_BANNER_IGNORE_KEY);
    return null;
  }
  return expiry;
}

export function isReloadBannerIgnored(): boolean {
  return Boolean(readIgnoreExpiry());
}

export function ignoreReloadBanner(duration = RELOAD_BANNER_IGNORE_TTL) {
  if (typeof window === "undefined") return;
  const expiry = Date.now() + duration;
  safeLocalStorageSet(RELOAD_BANNER_IGNORE_KEY, expiry.toString());
}

export function markReloadBannerVisible(value = true) {
  if (typeof window === "undefined") return;
  (window as any)[RELOAD_BANNER_FLAG] = value;
}

export function dismissReloadBannerFlag() {
  if (typeof window === "undefined") return;
  (window as any)[RELOAD_BANNER_FLAG] = false;
}

export function shouldShowReloadBanner() {
  if (typeof window === "undefined") return false;
  if (isReloadBannerIgnored()) {
    dismissReloadBannerFlag();
    return false;
  }
  return Boolean((window as any)[RELOAD_BANNER_FLAG]);
}

export function getReloadBannerIgnoreExpiry(): number | null {
  return readIgnoreExpiry();
}

function triggerQaReloadBanner() {
  if (typeof window === "undefined") return;
  markReloadBannerVisible();
  window.dispatchEvent(new Event(QA_TRIGGER_EVENT));
}

function registerQaReloadTrigger() {
  const qa = ensureQaGlobal();
  if (!qa.triggerReloadBanner) {
    qa.triggerReloadBanner = triggerQaReloadBanner;
  }
}

export function initQaReloadTrigger() {
  if (typeof window === "undefined") return;
  const enableQaHooks =
    import.meta.env.VITE_ENABLE_E2E_HOOKS === "1";
  if (!enableQaHooks) return;
  console.info("[UQ] QA reload hooks enabled (VITE_ENABLE_E2E_HOOKS=1)");
  registerQaReloadTrigger();
  const params = new URLSearchParams(window.location.search);
  if (params.get(QA_RELOAD_PARAM) === "1") {
    triggerQaReloadBanner();
  }
}
