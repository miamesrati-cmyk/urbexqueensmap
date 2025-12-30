import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "quill/dist/quill.snow.css";
import { CartProvider } from "./contexts/CartContext";
import { AuthUIProvider } from "./contexts/AuthUIContext";
import { ProStatusProvider } from "./contexts/ProStatusContext";
import {
  createReloadGuard,
  isReloadBannerIgnored,
  markReloadBannerVisible,
  initQaReloadTrigger,
} from "./utils/reloadGuard";
import { initQaAuthHooks } from "./utils/qaTools.ts";
import SecurityLockOverlay from "./components/SecurityLockOverlay";
import {
  safeLocalStorageClear,
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeSessionStorageClear,
  safeSessionStorageGet,
  safeSessionStorageRemove,
  safeSessionStorageSet,
} from "./utils/storage";
import { captureException } from "./lib/monitoring";

const APP_VERSION =
  import.meta.env.VITE_APP_VERSION ??
  import.meta.env.VITE_COMMIT_SHA ??
  import.meta.env.VITE_BUILD_TIME ??
  "dev";
const LEGAL_CONSENT_KEY = "urbexqueens_legalConsent_v1";
const SETTINGS_KEY = "urbexqueens_settings_v1";
const CART_STORAGE_KEY = "urbexqueens_cart";
const GUEST_SPOT_STORAGE_KEY = "urbex_guestSpotUsage";
const GUEST_PILL_CLOSE_KEY = "urbex_guestPillClosedAt";

const KEEP_KEYS = [
  LEGAL_CONSENT_KEY,
  SETTINGS_KEY,
  CART_STORAGE_KEY,
  GUEST_SPOT_STORAGE_KEY,
  GUEST_PILL_CLOSE_KEY,
];

function applyE2EConsentOverride() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const skipParam = params.get("skipDisclaimers");
  const storedSkip = window.localStorage.getItem("UQ_SKIP_DISCLAIMERS") === "1";
  if (skipParam === "1" || storedSkip) {
    safeLocalStorageSet(LEGAL_CONSENT_KEY, "accepted");
    if (skipParam === "1") {
      params.delete("skipDisclaimers");
      const hash = window.location.hash || "";
      const query = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState({}, "", `${window.location.pathname}${query}${hash}`);
    }
  }
}

function installGlobalCrashGuard() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    console.error("GLOBAL_ERROR", event.error || event.message);
    (window as any).__UQ_LAST_ERROR__ = {
      type: "error",
      message: String(event.message),
      stack: event.error?.stack,
    };
    captureException(event.error ?? event);
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    console.error("GLOBAL_REJECTION", event.reason);
    (window as any).__UQ_LAST_ERROR__ = {
      type: "rejection",
      message: String(event.reason?.message || event.reason),
      stack: event.reason?.stack,
    };
    captureException(event.reason ?? event);
  });
}

installGlobalCrashGuard();
initQaReloadTrigger();
initQaAuthHooks();
applyE2EConsentOverride();
// DEV: uncomment to force the QA avatar mode locally
// if (import.meta.env.DEV && typeof document !== "undefined") {
//   document.documentElement.dataset.qaAvatar = "off";
// }
const localStorageAdapter = {
  getItem: (key: string) => safeLocalStorageGet(key),
  setItem: (key: string, value: string) => safeLocalStorageSet(key, value),
  removeItem: (key: string) => safeLocalStorageRemove(key),
  clear: () => safeLocalStorageClear(),
};
const sessionStorageAdapter = {
  getItem: (key: string) => safeSessionStorageGet(key),
  setItem: (key: string, value: string) => safeSessionStorageSet(key, value),
  removeItem: (key: string) => safeSessionStorageRemove(key),
  clear: () => safeSessionStorageClear(),
};

const reloadGuard = createReloadGuard({
  storage: localStorageAdapter,
  sessionStorage: sessionStorageAdapter,
  reload: () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  },
  unregisterServiceWorkers: () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return Promise.resolve();
    }
    return navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) =>
            registration.unregister().catch((err) => {
              console.error("Failed to unregister SW", err);
            })
          )
        )
      )
      .then(() => undefined)
      .catch((err) => console.error("Failed to unregister SW", err));
  },
});

const cleanStatus = reloadGuard.ensureCleanStorage(APP_VERSION, KEEP_KEYS);
if (!cleanStatus.reloaded) {
  if (cleanStatus.showBanner && !isReloadBannerIgnored()) {
    markReloadBannerVisible();
  }
  ReactDOM.createRoot(document.getElementById("root")! as HTMLElement).render(
      <React.StrictMode>
        <CartProvider>
          <ProStatusProvider>
            <AuthUIProvider>
              <App />
              <SecurityLockOverlay />
            </AuthUIProvider>
          </ProStatusProvider>
        </CartProvider>
      </React.StrictMode>
  );
}
