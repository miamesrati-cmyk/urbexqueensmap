import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import mapboxgl from "mapbox-gl";

type LngLatLikeTuple = [number, number];

export type MapViewProps = {
  className?: string;
  initialCenter?: LngLatLikeTuple;
  initialZoom?: number;
  styleUrl?: string;
  interactive?: boolean;
  nightVisionActive?: boolean;
  onMapReady?: (map: mapboxgl.Map) => void;
};

const DEFAULT_CENTER_MTL: LngLatLikeTuple = [-73.5673, 45.5017];
const DEFAULT_ZOOM = 10;
const DEFAULT_STYLE_URL = "mapbox://styles/mapbox/dark-v11";

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
    return payload;
  } catch (error) {
    console.log("[UQ][LOAD_STATE][ERR]", error);
    return null;
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

export default function MapView({
  className,
  initialCenter = DEFAULT_CENTER_MTL,
  initialZoom = DEFAULT_ZOOM,
  styleUrl,
  interactive = true,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const loadStateIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsAddedRef = useRef(false);
  const layoutStableResizeFramesRef = useRef<{
    first: number | null;
    second: number | null;
  }>({ first: null, second: null });
  const mapFailureTimerRef = useRef<number | null>(null);
  const retryCooldownTimerRef = useRef<number | null>(null);
  const lastLoadStateTickRef = useRef<Record<string, unknown> | null>(null);
  const lastCanvasDebugRef = useRef<Record<string, unknown> | null>(null);
  const lastMapboxErrorRef = useRef<Record<string, unknown> | null>(null);
  const failureReasonRef = useRef<string | null>(null);
  const lastStyleUrlRef = useRef(
    styleUrl || "mapbox://styles/mapbox/dark-v11"
  );
  const [mapFailed, setMapFailed] = useState(false);
  const [retryCooldown, setRetryCooldown] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const [isOnline, setIsOnline] = useState(
    () => (typeof window === "undefined" ? true : window.navigator.onLine)
  );
  const token =
    (import.meta as any).env?.VITE_MAPBOX_TOKEN ||
    (import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN ||
    "";
  const isDevEnv = Boolean((import.meta as any).env?.DEV);
  const storageDebugFlag =
    typeof window !== "undefined" &&
    window.localStorage.getItem("UQ_DEBUG_MAP") === "1";
  const debugMode = storageDebugFlag;
  const envDebugRaw = (import.meta as any).env?.VITE_UQ_MAP_DEBUG;
  const envDebugFlag =
    typeof envDebugRaw === "string" && envDebugRaw.toLowerCase() === "true";
  const debugEnabled = envDebugFlag || storageDebugFlag;
  const debugSource = envDebugFlag
    ? "env"
    : storageDebugFlag
    ? "localStorage"
    : "none";

  const resolvedStyleUrl = useMemo(() => {
    return styleUrl || DEFAULT_STYLE_URL;
  }, [styleUrl]);

  const resolvedStyleUrlRef = useRef(resolvedStyleUrl);
  useEffect(() => {
    resolvedStyleUrlRef.current = resolvedStyleUrl;
  }, [resolvedStyleUrl]);

  const onMapReadyRef = useRef(onMapReady);
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    void mapRetryKey;
    const el = containerRef.current;
    if (!el) return;
    if (mapRef.current) return;

    lastLoadStateTickRef.current = null;
    lastCanvasDebugRef.current = null;
    lastMapboxErrorRef.current = null;

    if (isDevEnv) {
      console.log(
        `[UQ][MAP_DEBUG] enabled=${debugEnabled} source=${debugSource}`
      );
      console.log("[UQ][MAP_STYLE_URL]", resolvedStyleUrlRef.current);
    }

    if (!token) {
      console.error(
        "[UQ][MAP_INIT_BLOCKED] Missing Mapbox token (VITE_MAPBOX_TOKEN)."
      );
      return;
    }

    mapboxgl.accessToken = token;

    const clearFailureTimer = () => {
      if (
        mapFailureTimerRef.current !== null &&
        typeof window !== "undefined"
      ) {
        window.clearTimeout(mapFailureTimerRef.current);
        mapFailureTimerRef.current = null;
      }
    };

    const markFailure = (reason: string) => {
      if (failureReasonRef.current === reason) return;
      clearFailureTimer();
      failureReasonRef.current = reason;
      setMapFailed(true);
      if (isDevEnv || debugMode) {
        console.warn(`[UQ][MAP_FAIL] reason=${reason}`);
      }
    };

    const scheduleStyleFailure = () => {
      if (typeof window === "undefined") return;
      clearFailureTimer();
      mapFailureTimerRef.current = window.setTimeout(() => {
        if (!mapRef.current) return;
        if (!mapRef.current.isStyleLoaded?.()) {
          markFailure("style_timeout");
        }
      }, 10000);
    };

    const styleForMap = resolvedStyleUrlRef.current;
    lastStyleUrlRef.current = styleForMap;
    const map = new mapboxgl.Map({
      container: el,
      style: styleForMap,
      center: initialCenter,
      zoom: initialZoom,
      interactive,
    });
    onMapReadyRef.current?.(map);

    const addDefaultControls = () => {
      if (!interactive || controlsAddedRef.current) return;
      controlsAddedRef.current = true;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new mapboxgl.FullscreenControl(), "top-right");
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        "top-right"
      );
      map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");
    };

    const mapboxDebugProps: Array<keyof mapboxgl.Map & string> = [
      "showTileBoundaries",
      "showCollisionBoxes",
      "showTileAABBs",
    ];
    mapboxDebugProps.forEach((prop) => {
      if (typeof (map as any)[prop] !== "undefined") {
        (map as any)[prop] = !!debugEnabled;
      }
    });

    mapRef.current = map;
    scheduleStyleFailure();

    const cancelStableResizeFrames = () => {
      if (typeof window === "undefined") return;
      const current = layoutStableResizeFramesRef.current;
      if (current.first !== null) {
        window.cancelAnimationFrame(current.first);
        current.first = null;
      }
      if (current.second !== null) {
        window.cancelAnimationFrame(current.second);
        current.second = null;
      }
    };

    const scheduleStableResize = (referenceRect: { width: number; height: number }) => {
      if (typeof window === "undefined") return;
      cancelStableResizeFrames();
      layoutStableResizeFramesRef.current.first = window.requestAnimationFrame(() => {
        layoutStableResizeFramesRef.current.first = null;
        layoutStableResizeFramesRef.current.second = window.requestAnimationFrame(() => {
          layoutStableResizeFramesRef.current.second = null;
          const canvasElement = canvasRef.current;
          if (!canvasElement) return;
          const latestRect = canvasElement.getBoundingClientRect();
          if (
            latestRect.width !== referenceRect.width ||
            latestRect.height !== referenceRect.height
          ) {
            try {
              map.resize();
            } catch {
              // Resize may fail if map was removed.
            }
          }
        });
      });
    };

    if (isDevEnv) {
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
      lastMapboxErrorRef.current = {
        status: e?.error?.status,
        url: e?.error?.url,
        message: e?.error?.message,
      };
      markFailure("style_error");
    };

    const onStyleData = () => {
      console.log("[UQ][STYLE_DATA]");
    };

    const onLoad = () => {
      console.log("[UQ][MAP_LOADED]");
      addDefaultControls();
      requestAnimationFrame(() => map.resize());
      const canvasDebug = getCanvasDebug(map);
      const rect = canvasDebug.rect;
      scheduleStableResize(rect);
      const flatLine = `rectW=${rect.width} rectH=${rect.height} opacity=${"opacity" in canvasDebug ? canvasDebug.opacity : "n/a"} visibility=${
        "visibility" in canvasDebug ? canvasDebug.visibility : "n/a"
      } display=${"display" in canvasDebug ? canvasDebug.display : "n/a"} zIndex=${
        "zIndex" in canvasDebug ? canvasDebug.zIndex : "n/a"
      }`;
      console.log(`[UQ][CANVAS_DEBUG_FLAT] ${flatLine}`);
      console.log(`[UQ][CANVAS_DEBUG_JSON] ${safeJson(canvasDebug)}`);
      lastCanvasDebugRef.current = {
        canvasW: canvasDebug.canvasW,
        canvasH: canvasDebug.canvasH,
        opacity: canvasDebug.opacity,
        visibility: canvasDebug.visibility,
        display: canvasDebug.display,
        zIndex: canvasDebug.zIndex,
      };
      clearLoadInterval();
      clearFailureTimer();
      failureReasonRef.current = null;
      setMapFailed(false);
      setRetryCooldown(false);
      setRetryAttempts(0);
    };

    map.on("error", onError);
    map.on("styledata", onStyleData);
    map.on("load", onLoad);

    logLoadState(map, "immediate");
    const clearLoadInterval = () => {
      clearLoadStateInterval(loadStateIntervalRef);
      if (isDevEnv) {
        console.log("[UQ][LOAD_STATE_INTERVAL] cleared");
      }
    };
    let loadStateTick = 0;
    if (typeof window !== "undefined") {
      loadStateIntervalRef.current = window.setInterval(() => {
        loadStateTick += 1;
        const payload = logLoadState(map, `tick_${loadStateTick}`);
        if (loadStateTick === 4 && payload) {
          lastLoadStateTickRef.current = payload;
        }
        if (loadStateTick >= 4) {
          clearLoadInterval();
        }
      }, 800);
      if (isDevEnv) {
        console.log("[UQ][LOAD_STATE_INTERVAL] started");
      }
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
        markFailure("webgl_context_lost");
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
      clearLoadInterval();
      clearFailureTimer();
      cancelStableResizeFrames();
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
        controlsAddedRef.current = false;
        mapRef.current = null;
        resizeObsRef.current = null;
        canvasRef.current = null;
      }
    };
  }, [
    token,
    interactive,
    initialCenter,
    initialZoom,
    isDevEnv,
    debugMode,
    debugEnabled,
    debugSource,
    mapRetryKey,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lastStyleUrlRef.current === resolvedStyleUrl) return;
    lastStyleUrlRef.current = resolvedStyleUrl;
    controlsAddedRef.current = false;
    try {
      map.setStyle(resolvedStyleUrl);
    } catch (error) {
      console.error("[UQ][MAP_STYLE_CHANGE_ERR]", error);
    }
  }, [resolvedStyleUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isDevEnv) return;
    console.log("[UQ][MAPVIEW_MOUNT]");
    return () => {
      console.log("[UQ][MAPVIEW_UNMOUNT]");
    };
  }, [isDevEnv]);

  useEffect(() => {
    return () => {
      if (
        retryCooldownTimerRef.current !== null &&
        typeof window !== "undefined"
      ) {
        window.clearTimeout(retryCooldownTimerRef.current);
      }
    };
  }, []);

  // See docs/MAP_DIAGNOSTICS.md for the manual diagnostics workflow.
  const handleRetry = () => {
    if (retryCooldown || !isOnline || retryAttempts >= 3) return;
    if (
      retryCooldownTimerRef.current !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(retryCooldownTimerRef.current);
    }
    setRetryCooldown(true);
    if (typeof window !== "undefined") {
      retryCooldownTimerRef.current = window.setTimeout(() => {
        setRetryCooldown(false);
        retryCooldownTimerRef.current = null;
      }, 2500);
    }
    failureReasonRef.current = null;
    setMapFailed(false);
    setRetryAttempts((prev) => prev + 1);
    setMapRetryKey((prev) => prev + 1);
  };

  const copyDiagnostics = () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      styleUrl: resolvedStyleUrl,
      online:
        typeof navigator === "undefined" ? "unknown" : navigator.onLine,
      attemptCount: retryAttempts,
      cooldown: retryCooldown,
      lastLoadStateTick: lastLoadStateTickRef.current,
      lastCanvasDebug: lastCanvasDebugRef.current,
      lastMapboxError: lastMapboxErrorRef.current,
      mapFailed,
      failureReason,
    };
    const payload = `Map diagnostics:
${safeJson(diagnostics)}`;
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.writeText === "function"
    ) {
      void navigator.clipboard.writeText(payload);
    } else {
      console.warn("Diagnostics clipboard unavailable:", payload);
    }
  };

  const failureReason =
    (isDevEnv || debugMode) && failureReasonRef.current
      ? failureReasonRef.current
      : null;
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
          {failureReason && <small>reason={failureReason}</small>}
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
          {debugMode && (
            <button
              type="button"
              onClick={copyDiagnostics}
              style={{
                background: "#222",
                border: "none",
                borderRadius: 999,
                color: "#fff",
                padding: "6px 14px",
                cursor: "pointer",
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              Copy diagnostics
            </button>
          )}
        </div>
      )}
    </div>
  );
}
