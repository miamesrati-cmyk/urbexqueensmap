import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./styles/subtle-enhancements.css";
import "./styles/premium-header.css";
import "./styles/enhanced-header.css";
import "./styles/dm-instagram-style.css";
import "./styles/enhanced-pro-page.css";
import "./styles/pro-gaming.css";
import "./styles/enhanced-mapbox-controls.css";
import "./styles/enhanced-map-ui.css";
import "./styles/menuSpotsStats.css";
import "./styles/profileMenuFix.css";
import "./styles/pin-animations.css"; // Pin state change micro-animations
import "./styles/time-rift.css"; // 🕰️ Time Rift (History PRO feature)
import "./styles/mapbox-controls-override.css"; // OVERRIDE FORCÉ EN DERNIER
// Mapbox CSS importé globalement, mais JS sera lazy-loadé par les composants
import "mapbox-gl/dist/mapbox-gl.css";
import "quill/dist/quill.snow.css";

// Filter out non-critical Mapbox warnings and dev noise
if (typeof console !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;
  
  const shouldSuppress = (message: any): boolean => {
    if (typeof message !== 'string') return false;
    
    // Suppress Mapbox glyph warnings (non-critical, cosmetic only)
    if (message.includes('glyphs > 65535 not supported')) return true;
    
    // Suppress Mapbox style diff warnings (expected when changing styles)
    if (message.includes('Unable to perform style diff') && message.includes('Rebuilding the style')) return true;
    
    // Suppress Chrome performance violations in dev (caused by React DevTools, extensions)
    if (message.includes('[Violation]') && message.includes('handler took')) return true;
    
    // Suppress Mapbox internal rendering errors
    if (message.includes('continuePlacement') ||
        message.includes('_updatePlacement') ||
        (message.includes('Cannot read properties of undefined') && 
         message.includes('mapbox'))) return true;
    
    // Suppress Firestore CORS errors (configuration issue, not app error)
    if (message.includes('firestore.googleapis.com') && 
        (message.includes('cors') || message.includes('access control') || message.includes('fetch api'))) {
      console.info('[UQ] ⚠️ Firestore CORS - Vérifiez Firebase Console → Authentication → Authorized domains → Ajoutez "localhost"');
      return true;
    }
    
    return false;
  };
  
  console.warn = (...args: any[]) => {
    if (shouldSuppress(args[0])) return;
    originalWarn.apply(console, args);
  };
  
  console.error = (...args: any[]) => {
    if (shouldSuppress(args[0])) return;
    originalError.apply(console, args);
  };
  
  console.log = (...args: any[]) => {
    if (shouldSuppress(args[0])) return;
    originalLog.apply(console, args);
  };
}

// Import Firestore debug utilities
import "./utils/firestoreDebug";

// Expose debug utils in dev mode (console access)
if (import.meta.env.DEV) {
  import("./utils/debugClusterPrefs").then((m) => {
    (window as any).debugCluster = m;
    console.log("[DEBUG] 🛠️ Cluster debug utils available:");
    console.log("  - window.debugCluster.inspectClusterPrefs()");
    console.log("  - window.debugCluster.resetClusterPrefs()");
    console.log("  - window.debugCluster.setClusterPrefs(true/false)");
    console.log("  - window.debugCluster.clearAllUrbexPrefs()");
  });
}

import { CartProvider } from "./contexts/CartContext";
import { AuthUIProvider } from "./contexts/AuthUIContext";
import { ProStatusProvider } from "./contexts/ProStatusContext";
import { ToastProvider } from "./contexts/ToastContext";
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
const SKIN_MODE_STORAGE_KEY = "uq_skin_mode";

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
    const errorMessage = String(event.error?.message || event.message || '');
    
    // Suppress Mapbox internal errors that don't affect functionality
    if (errorMessage.includes('continuePlacement') || 
        errorMessage.includes('Cannot read properties of undefined') && errorMessage.includes('mapbox')) {
      // These are internal Mapbox rendering errors that self-recover
      // Don't log to avoid console spam
      return;
    }
    
    console.error("GLOBAL_ERROR", event.error || event.message);
    (window as any).__UQ_LAST_ERROR__ = {
      type: "error",
      message: errorMessage,
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

type SkinMode = "refinement" | "default";

function determineSkinMode(): SkinMode {
  if (typeof window === "undefined") {
    return "refinement";
  }
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("skin");
  if (requested === "default") {
    safeLocalStorageSet(SKIN_MODE_STORAGE_KEY, "default");
    return "default";
  }
  if (requested === "refinement") {
    safeLocalStorageSet(SKIN_MODE_STORAGE_KEY, "refinement");
    return "refinement";
  }
  const stored = window.localStorage.getItem(SKIN_MODE_STORAGE_KEY);
  if (stored === "default") {
    return "default";
  }
  return "refinement";
}

function applySkinMode(mode: SkinMode) {
  if (typeof document === "undefined") return;
  if (mode === "refinement") {
    document.body.classList.add("uq-preview-refinement");
  } else {
    document.body.classList.remove("uq-preview-refinement");
  }
}

installGlobalCrashGuard();
initQaReloadTrigger();
initQaAuthHooks();
applyE2EConsentOverride();
const currentSkinMode = determineSkinMode();
applySkinMode(currentSkinMode);
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
        <ToastProvider>
          <CartProvider>
            <ProStatusProvider>
              <AuthUIProvider>
                <App />
                <SecurityLockOverlay />
              </AuthUIProvider>
            </ProStatusProvider>
          </CartProvider>
        </ToastProvider>
      </React.StrictMode>
  );
}
