import { useEffect, useState } from "react";

type CrashInfo = {
  type: string;
  message: string;
  stack?: string;
};

type OverlayDebug = {
  count: number;
  highest?: {
    selector: string;
    zIndex: string;
    pointerEvents: string;
  };
};

const OVERLAY_SELECTORS = [
  ".pro-modal",
  ".pro-modal-backdrop",
  ".auth-modal",
  ".auth-modal-backdrop",
  ".cart-drawer",
  ".cart-drawer-backdrop",
  ".map-overlay-form",
  ".missions-panel",
];

export function CrashBanner() {
  const isDev = import.meta.env.DEV;
  const [errorInfo, setErrorInfo] = useState<CrashInfo | null>(null);
  const [debugInfo, setDebugInfo] = useState<OverlayDebug>({ count: 0 });

  useEffect(() => {
    if (!isDev) return;
    const interval = window.setInterval(() => {
      if (typeof document === "undefined") return;
      const last = (window as any).__UQ_LAST_ERROR__;
      if (last) {
        setErrorInfo(last);
      }

      const overlays: {
        element: Element;
        selector: string;
      }[] = [];
      OVERLAY_SELECTORS.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
          overlays.push({ element: el, selector });
        });
      });

      if (overlays.length === 0) {
        setDebugInfo({ count: 0 });
      } else {
        const sorted = overlays.sort((a, b) => {
          const za = getComputedStyle(a.element).zIndex || "0";
          const zb = getComputedStyle(b.element).zIndex || "0";
          return Number(zb) - Number(za);
        });
        const active = sorted[0];
        setDebugInfo({
          count: overlays.length,
          highest: {
            selector: active.selector,
            zIndex: getComputedStyle(active.element).zIndex || "auto",
            pointerEvents:
              getComputedStyle(active.element).pointerEvents || "auto",
          },
        });
      }
    }, 500);

    return () => {
      window.clearInterval(interval);
    };
  }, [isDev]);

  const overflow =
    typeof document === "undefined" ? "n/a" : document.body.style.overflow;

  const handleReset = () => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "auto";
      document.body.classList.remove("modal-open", "overflow-hidden");
    }
    window.dispatchEvent(new CustomEvent("urbex_reset_ui"));
    (window as any).__UQ_LAST_ERROR__ = null;
    setErrorInfo(null);
  };

  if (!isDev || !errorInfo) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        right: 12,
        zIndex: 999999,
        padding: 12,
        borderRadius: 12,
        background: "rgba(0, 0, 0, 0.85)",
        color: "#fff",
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
      }}
    >
      <strong>Crash détecté:</strong> {errorInfo.message}
      {errorInfo.stack && (
        <div style={{ opacity: 0.8, maxHeight: 80, overflow: "hidden" }}>
          {errorInfo.stack.slice(0, 200)}
        </div>
      )}
      <div style={{ fontSize: 11, opacity: 0.9 }}>
        Overflow: {overflow || "auto"} · Overlays: {debugInfo.count}
        {debugInfo.highest && (
          <>
            {" "}
            · Active: {debugInfo.highest.selector} (z:{debugInfo.highest.zIndex},{" "}
            pointer:{debugInfo.highest.pointerEvents})
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleReset}
          style={{
            marginTop: 8,
            alignSelf: "flex-start",
            background: "rgba(255, 255, 255, 0.08)",
            color: "#fff",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            borderRadius: 8,
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={handleReset}
          style={{
            marginTop: 8,
            alignSelf: "flex-start",
            background: "rgba(255, 90, 211, 0.9)",
            color: "#050305",
            border: "none",
            borderRadius: 8,
            padding: "4px 12px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          RESET UI
        </button>
      </div>
    </div>
  );
}
