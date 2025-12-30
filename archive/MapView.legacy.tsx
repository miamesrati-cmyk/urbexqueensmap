import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import mapboxgl from "mapbox-gl";
import { captureBreadcrumb, captureMessage } from "../lib/monitoring";

type LngLatLikeTuple = [number, number];

export type MapViewProps = {
  className?: string;
  initialCenter?: LngLatLikeTuple;
  initialZoom?: number;
  styleUrl?: string;
  interactive?: boolean;
  nightVisionActive?: boolean;
};

const DEFAULT_CENTER_MTL: LngLatLikeTuple = [-73.5673, 45.5017];
const DEFAULT_ZOOM = 10;

const safeJson = (value: unknown) => {
  try {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === "bigint") {
          return String(val);
        }
        if (typeof val === "function") {
          return "<function>";
        }
        if (val instanceof Event) {
          return {
            type: val.type,
          };
        }
        return val;
      },
      2
    );
  } catch (error) {
    return String(error);
  }
};

const clearLoadStateInterval = (ref: MutableRefObject<number | null>) => {
  if (ref.current !== null) {
    if (typeof window !== "undefined") {
      window.clearInterval(ref.current);
    }
    ref.current = null;
  }
};

const logLoadState = (map: mapboxgl.Map, tag: string) => {
  try {
    const loaded = map.loaded();
    const styleLoaded = map.isStyleLoaded?.();
    const tilesLoaded = map.areTilesLoaded?.();
    const center = map.getCenter();
    const payload = {
      loaded,
      styleLoaded,
      tilesLoaded,
      zoom: map.getZoom(),
      center: {
        lng: center.lng,
        lat: center.lat,
      },
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    };
    console.log(
      `[UQ][LOAD_STATE_FLAT][${tag}] loaded=${loaded} styleLoaded=${styleLoaded} tilesLoaded=${tilesLoaded}`
    );
    console.log(`[UQ][LOAD_STATE_JSON][${tag}] ${safeJson(payload)}`);
  } catch (error) {
    console.log("[UQ][LOAD_STATE][ERR]", error);
  }
};

const getCanvasDebug = (map: mapboxgl.Map) => {
  const canvas = map.getCanvas();
  const rect = canvas.getBoundingClientRect();
  const rectData = {
    width: rect.width,
    height: rect.height,
    x: rect.x,
    y: rect.y,
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
  };
  if (typeof window === "undefined") {
    return {
      canvasW: canvas.width,
      canvasH: canvas.height,
      rect: rectData,
    };
  }
  const cs = window.getComputedStyle(canvas);
  return {
    canvasW: canvas.width,
    canvasH: canvas.height,
    rect: rectData,
    opacity: cs.opacity,
    visibility: cs.visibility,
    display: cs.display,
    zIndex: cs.zIndex,
  };
};

const emitMapTelemetry = (
  eventName: string,
  payload: Record<string, unknown>,
  severity: "info" | "warning" | "error" = "info"
) => {
  if (typeof window !== "undefined") {
    const globalTelemetry = (window as any).__UQ_TELEMETRY__;
    globalTelemetry?.trackEvent?.(eventName, payload);
  }
  captureBreadcrumb({
    message: `[UQ][${eventName}]`,
    category: "mapbox",
    level: severity,
    data: payload,
  });
  captureMessage(`[UQ][${eventName}] ${safeJson(payload)}`, severity);
};

export default function MapView({
  className,
  initialCenter = DEFAULT_CENTER_MTL,
  initialZoom = DEFAULT_ZOOM,
  styleUrl,
  interactive = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const loadStateIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const failureTimerRef = useRef<number | null>(null);
  const degradeTimerRef = useRef<number | null>(null);
  const retryCooldownRef = useRef<number | null>(null);
  const failureReasonRef = useRef<string | null>(null);
  const lastOfflineSentAtRef = useRef<number | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<
    "loading" | "degraded" | "ready" | "failed"
  >("loading");
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [retryCooldown, setRetryCooldown] = useState(false);
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const [isOnline, setIsOnline] = useState(
    () => (typeof window === "undefined" ? true : window.navigator.onLine)
  );
  const token =
    (import.meta as any).env?.VITE_MAPBOX_TOKEN ||
    (import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN ||
    "";
  const isDevEnv = Boolean((import.meta as any).env?.DEV);
  const debugMode =
    typeof window !== "undefined" &&
    window.localStorage.getItem("UQ_DEBUG_MAP") === "1";

  const resolvedStyleUrl = useMemo(() => {
    return styleUrl || "mapbox://styles/mapbox/dark-v11";
  }, [styleUrl]);

  const clearFailureTimer = useCallback(() => {
    if (failureTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(failureTimerRef.current);
      failureTimerRef.current = null;
    }
  }, []);

  const clearDegradeTimer = useCallback(() => {
    if (degradeTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(degradeTimerRef.current);
      degradeTimerRef.current = null;
    }
  }, []);

  const markFailure = useCallback(
    (reason: string, options?: { status?: number }) => {
      const now = Date.now();
      if (reason === "offline") {
        if (
          lastOfflineSentAtRef.current &&
          now - lastOfflineSentAtRef.current < 15000
        ) {
          setMapFailed(true);
          setMapStatus("failed");
          failureReasonRef.current = reason;
          setFailureReason(reason);
          return;
        }
        lastOfflineSentAtRef.current = now;
      }
      if (mapFailed && failureReasonRef.current === reason) return;
      failureReasonRef.current = reason;
      setFailureReason(reason);
      setMapFailed(true);
      setMapStatus("failed");
      clearFailureTimer();
      clearDegradeTimer();
      const severity =
        reason === "mapbox_error" &&
        options?.status &&
        [401, 403].includes(options.status) &&
        retryAttempts >= 2
          ? "error"
          : "warning";
      emitMapTelemetry(
        "MAP_FAIL",
        {
          reason,
          attemptCount: Math.min(retryAttempts, 3),
          online: isOnline,
          status: options?.status,
        },
        severity
      );
    },
    [clearDegradeTimer, clearFailureTimer, isOnline, mapFailed, retryAttempts]
  );

  const scheduleStyleTimeouts = useCallback(() => {
    if (typeof window === "undefined") return;
    clearFailureTimer();
    clearDegradeTimer();
    setMapStatus("loading");
    degradeTimerRef.current = window.setTimeout(() => {
      if (!mapRef.current) return;
      if (
        mapRef.current.isStyleLoaded?.() &&
        mapRef.current.areTilesLoaded?.()
      ) {
        return;
      }
      setMapStatus("degraded");
      failureReasonRef.current = "timeout_soft";
      setFailureReason("timeout_soft");
    }, 5000);
    failureTimerRef.current = window.setTimeout(() => {
      if (!mapRef.current) return;
      if (
        mapRef.current.isStyleLoaded?.() &&
        mapRef.current.areTilesLoaded?.()
      ) {
        return;
      }
      setMapStatus("failed");
      markFailure("timeout");
    }, 10000);
  }, [clearDegradeTimer, clearFailureTimer, markFailure]);

  useEffect(() => {
    if (!isOnline) {
      markFailure("offline");
    }
  }, [isOnline, markFailure]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      setIsOnline(true);
      setRetryCooldown(false);
      lastOfflineSentAtRef.current = null;
    };
    const handleOffline = () => {
      setIsOnline(false);
      markFailure("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [markFailure]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    return () => {
      if (retryCooldownRef.current !== null) {
        window.clearTimeout(retryCooldownRef.current);
      }
    };
  }, []);

  // Manual validation guide:
  // 1) Switch the browser offline so `mapFailed` surfaces the overlay/fallback UI.
  // 2) Click “Réessayer” to clear the failure, increment `mapRetryKey`, and remount the map logic.
  // 3) Go back online and confirm the overlay disappears once the map load completes again.
  const handleRetry = useCallback(() => {
    if (retryCooldown || !isOnline || retryAttempts >= 3) return;
    emitMapTelemetry("MAP_RETRY", {
      attemptCount: retryAttempts,
      online: isOnline,
      cooldown: retryCooldown,
    });
    setRetryCooldown(true);
    if (typeof window !== "undefined") {
      if (retryCooldownRef.current !== null) {
        window.clearTimeout(retryCooldownRef.current);
      }
      retryCooldownRef.current = window.setTimeout(() => {
        setRetryCooldown(false);
        retryCooldownRef.current = null;
      }, 2500);
    }
    setFailureReason(null);
    setMapFailed(false);
    setRetryAttempts((prev) => prev + 1);
    setMapRetryKey((prev) => prev + 1);
  }, [isOnline, retryAttempts, retryCooldown]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (mapRef.current) return;
    if (!token) {
      console.error(
        "[UQ][MAP_INIT_BLOCKED] Missing Mapbox token (VITE_MAPBOX_TOKEN)."
      );
      return;
    }
    if (!isOnline) {
      markFailure("offline");
      return;
    }
    mapboxgl.accessToken = token;
    clearFailureTimer();
    clearDegradeTimer();
    setMapFailed(false);
    setFailureReason(null);
    setMapStatus("loading");
    if (debugMode) {
      el.classList.add("uq-debug-map");
      console.warn("[UQ][DEBUG_MAP] enabled");
    } else {
      el.classList.remove("uq-debug-map");
    }
    const map = new mapboxgl.Map({
      container: el,
      style: resolvedStyleUrl,
      center: initialCenter,
      zoom: initialZoom,
      interactive,
    });
    mapRef.current = map;
    scheduleStyleTimeouts();
    if (isDevEnv) {
      console.log("[UQ][MAP_STYLE_URL]", resolvedStyleUrl);
      console.log("[UQ][MAPBOX_TOKEN_PRESENT]", Boolean(token));
    }
    const onError = (e: any) => {
      console.error("[UQ][MAPBOX_ERROR]", {
        message: e?.error?.message,
        status: e?.error?.status,
        url: e?.error?.url,
        sourceId: e?.sourceId,
        tile: e?.tile,
        raw: e,
      });
      markFailure("mapbox_error");
    };
    const onStyleData = () => {
      console.log("[UQ][STYLE_DATA]");
    };
    const onLoad = () => {
      console.log("[UQ][MAP_LOADED]");
      requestAnimationFrame(() => map.resize());
      const canvasDebug = getCanvasDebug(map);
      const rect = canvasDebug.rect;
      const flatLine = `rectW=${rect.width} rectH=${rect.height} opacity=${
        "opacity" in canvasDebug ? canvasDebug.opacity : "n/a"
      } visibility=${
        "visibility" in canvasDebug ? canvasDebug.visibility : "n/a"
      } display=${"display" in canvasDebug ? canvasDebug.display : "n/a"} zIndex=${
        "zIndex" in canvasDebug ? canvasDebug.zIndex : "n/a"
      }`;
      console.log(`[UQ][CANVAS_DEBUG_FLAT] ${flatLine}`);
      console.log(`[UQ][CANVAS_DEBUG_JSON] ${safeJson(canvasDebug)}`);
      clearFailureTimer();
      clearDegradeTimer();
      failureReasonRef.current = null;
      setFailureReason(null);
      setMapFailed(false);
      setMapStatus("ready");
      setRetryAttempts(0);
    };
    map.on("error", onError);
    map.on("styledata", onStyleData);
    map.on("load", onLoad);
    logLoadState(map, "immediate");
    let loadStateTick = 0;
    if (typeof window !== "undefined") {
      loadStateIntervalRef.current = window.setInterval(() => {
        loadStateTick += 1;
        logLoadState(map, `tick_${loadStateTick}`);
        if (loadStateTick >= 4) {
          clearLoadStateInterval(loadStateIntervalRef);
        }
      }, 800);
    }
    if (debugMode) {
      // @ts-ignore
      map.showTileBoundaries = true;
      // @ts-ignore
      map.showCollisionBoxes = true;
    }
    const canvas = map.getCanvas();
    canvasRef.current = canvas;
    let canvasLostHandler: ((event: Event) => void) | null = null;
    let canvasRestoredHandler: ((event: Event) => void) | null = null;
    if (canvas) {
      canvasLostHandler = (event: Event) => {
        console.error("[UQ][WEBGL_CONTEXT_LOST]", event);
        if (event?.preventDefault) {
          event.preventDefault();
        }
        markFailure("webgl_lost");
      };
      canvasRestoredHandler = (event: Event) => {
        console.warn("[UQ][WEBGL_CONTEXT_RESTORED]", event);
      };
      canvas.addEventListener("webglcontextlost", canvasLostHandler, false);
      canvas.addEventListener(
        "webglcontextrestored",
        canvasRestoredHandler,
        false
      );
    }
    const ResizeObserverCtor =
      typeof window !== "undefined" && "ResizeObserver" in window
        ? ResizeObserver
        : null;
    const ro = ResizeObserverCtor
      ? new ResizeObserverCtor(() => {
          try {
            map.resize();
          } catch {
            // ResizeObserver can fire after unmount; ignore.
          }
        })
      : null;
    if (ro) {
      ro.observe(el);
      resizeObsRef.current = ro;
    }
    return () => {
      clearLoadStateInterval(loadStateIntervalRef);
      clearFailureTimer();
      clearDegradeTimer();
      try {
        map.off("error", onError);
        map.off("styledata", onStyleData);
        map.off("load", onLoad);
        if (canvas && canvasLostHandler) {
          canvas.removeEventListener("webglcontextlost", canvasLostHandler);
        }
        if (canvas && canvasRestoredHandler) {
          canvas.removeEventListener(
            "webglcontextrestored",
            canvasRestoredHandler
          );
        }
        ro?.disconnect();
        map.remove();
      } finally {
        mapRef.current = null;
        resizeObsRef.current = null;
        canvasRef.current = null;
        if (debugMode) {
          el.classList.remove("uq-debug-map");
        }
      }
    };
  }, [
    token,
    resolvedStyleUrl,
    interactive,
    initialCenter,
    initialZoom,
    isDevEnv,
    debugMode,
    isOnline,
    markFailure,
    clearFailureTimer,
    clearDegradeTimer,
    scheduleStyleTimeouts,
    mapRetryKey,
  ]);

  const attemptLimitReached = retryAttempts >= 3;
  const overlayMessage = !isOnline
    ? "Connexion interrompue"
    : attemptLimitReached
    ? "Recharge la page pour retenter."
    : "Réessaie ou recharge la page.";
  const buttonLabel = retryCooldown ? "…" : "Réessayer";
  const buttonDisabled = retryCooldown || !isOnline || attemptLimitReached;

  return (
    <div
      key={mapRetryKey}
      ref={containerRef}
      className={className || "mapbox-container"}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {mapFailed && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "rgba(0, 0, 0, 0.65)",
            color: "#fff",
            padding: 16,
            textAlign: "center",
            pointerEvents: "auto",
          }}
        >
          <strong style={{ fontSize: 18 }}>Carte indisponible</strong>
          <span>{overlayMessage}</span>
          {failureReason && (isDevEnv || debugMode) && (
            <small>reason={failureReason}</small>
          )}
          {attemptLimitReached && (
            <small>3 tentatives max, pense à recharger.</small>
          )}
          <button
            type="button"
            onClick={handleRetry}
            disabled={buttonDisabled}
            style={{
              background: buttonDisabled ? "#888" : "#ff5fa2",
              border: "none",
              borderRadius: 999,
              color: "#fff",
              padding: "8px 16px",
              cursor: buttonDisabled ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: buttonDisabled ? 0.6 : 1,
            }}
          >
            {buttonLabel}
          </button>
        </div>
      )}
    </div>
  );
}
