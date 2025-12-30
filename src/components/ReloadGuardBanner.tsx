import { useEffect, useState } from "react";
import {
  dismissReloadBannerFlag,
  getReloadBannerIgnoreExpiry,
  ignoreReloadBanner,
  markReloadBannerVisible,
  shouldShowReloadBanner,
  QA_TRIGGER_EVENT,
} from "../utils/reloadGuard";

function shouldForceReloadBanner() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("forceReloadBanner") === "1") {
    markReloadBannerVisible();
    return true;
  }
  if (window.localStorage.getItem("UQ_FORCE_RELOAD_BANNER") === "1") {
    markReloadBannerVisible();
    return true;
  }
  return false;
}

export default function ReloadGuardBanner() {
  const [visible, setVisible] = useState<boolean>(() => {
    return shouldShowReloadBanner() || shouldForceReloadBanner();
  });

  useEffect(() => {
    if (visible) {
      dismissReloadBannerFlag();
      return;
    }
    const expiry = getReloadBannerIgnoreExpiry();
    if (!expiry || typeof window === "undefined") return;
    const delay = Math.max(expiry - Date.now(), 0);
    const timer = window.setTimeout(() => {
      markReloadBannerVisible();
      if (shouldShowReloadBanner()) {
        setVisible(true);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleTrigger = () => {
      setVisible(true);
    };
    window.addEventListener(QA_TRIGGER_EVENT, handleTrigger);
    return () => {
      window.removeEventListener(QA_TRIGGER_EVENT, handleTrigger);
    };
  }, []);

  if (!visible) return null;

  const handleReload = () => {
    window.location.reload();
  };

  const handleIgnore = () => {
    ignoreReloadBanner();
    dismissReloadBannerFlag();
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 16,
        right: 16,
        zIndex: 999997,
        background: "rgba(5, 5, 12, 0.85)",
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 12,
        gap: 12,
        pointerEvents: "auto",
        boxShadow: "0 10px 34px rgba(0,0,0,0.45)",
      }}
      data-testid="reload-banner"
      role="alert"
    >
      <span style={{ flex: 1, marginRight: 8 }}>
        Une nouvelle version est prête. Recharger permet de tout synchroniser.
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleReload}
          style={{
            background: "linear-gradient(135deg,#ff5fa2,#6f72ff)",
            border: "none",
            borderRadius: 999,
            padding: "6px 18px",
            fontWeight: 700,
            cursor: "pointer",
            color: "#fff",
          }}
        >
          Recharger
        </button>
        <button
          type="button"
          onClick={handleIgnore}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 8,
            padding: "4px 10px",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}
