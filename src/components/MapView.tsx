import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import mapboxgl from "mapbox-gl";
import Skeleton from "./Skeleton";

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

const isSafariUserAgent = (ua: string) => {
  if (!ua) return false;
  return (
    /Safari/.test(ua) &&
    !/(Chrome|Chromium|CriOS|FxiOS|Edge|Edg|OPR|Opera)/i.test(ua)
  );
};

const BLOCKED_REQUEST_REGEX = /(blocked|csp|cors|token|network|ERR_BLOCKED_BY_CLIENT|403|401|429)/i;

const FAILURE_VARIANTS: Record<
  string,
  {
    title: string;
    ctaLabel: string;
    ctaUrl?: string;
  }
> = {
  webgl_context_unavailable: {
    title: "WebGL désactivé",
    ctaLabel: "Activer WebGL",
    ctaUrl: "https://support.apple.com/guide/safari/ibrw1081/ios",
  },
  storage_blocked: {
    title: "Mode privé détecté",
    ctaLabel: "Quitter le mode privé",
    ctaUrl: "https://support.apple.com/fr-fr/guide/safari/sfri40704/mac",
  },
  mapbox_request_blocked: {
    title: "Requêtes Mapbox bloquées",
    ctaLabel: "Vérifier token / bloqueur",
    ctaUrl: "https://docs.mapbox.com/help/troubleshooting/access-token/",
  },
};

const maybeLogMapboxRequestBlocked = (
  event: any,
  safari: boolean,
  diagnosticsEnabled: boolean
) => {
  const status = event?.error?.status;
  const message = event?.error?.message ?? event?.message ?? "";
  if (
    BLOCKED_REQUEST_REGEX.test(message) ||
    (typeof status === "number" && [401, 403, 429].includes(status))
  ) {
    if (diagnosticsEnabled) {
      console.warn("[UQ][MAPBOX_REQUEST_BLOCKED]", {
        message,
        status,
        url: event?.error?.url,
        safari,
      });
    }
    return true;
  }
  return false;
};

const STORAGE_PROBE_KEY = "__uq_storage_private_mode_probe__";

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

const MIN_MAP_BOOT_DISPLAY_MS = 250;

const getFriendlyFailureMessage = (reason: string) => {
  switch (reason) {
    case "style_timeout":
      return "Le style a pris trop de temps à charger.";
    case "style_error":
      return "Impossible de charger la carte.";
    case "webgl_context_lost":
      return "Le rendu graphique a été interrompu.";
    default:
      return "La carte est indisponible pour le moment.";
  }
};

export default function MapView({
  className,
  initialCenter = DEFAULT_CENTER_MTL,
  initialZoom = DEFAULT_ZOOM,
  styleUrl,
  interactive = true,
  onMapReady,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
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
  const mapLoadedRef = useRef(false);
  const mapResizedOnceRef = useRef(false);
  const bootStartRef = useRef(0);
  const bootTimerRef = useRef<number | null>(null);
  const lastStyleUrlRef = useRef(
    styleUrl || "mapbox://styles/mapbox/dark-v11"
  );
  const [mapBooting, setMapBooting] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailReason, setMapFailReason] = useState<string | null>(null);
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
  const clearBootTimer = useCallback(() => {
    if (
      bootTimerRef.current !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(bootTimerRef.current);
    }
    bootTimerRef.current = null;
  }, []);

  const resetBootCycle = useCallback(() => {
    mapLoadedRef.current = false;
    mapResizedOnceRef.current = false;
    bootStartRef.current =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now();
    clearBootTimer();
  }, [clearBootTimer]);

  const finishBootIfReady = useCallback(() => {
    if (!mapLoadedRef.current || !mapResizedOnceRef.current) return;
    setMapReady(true);
    const now =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now();
    const elapsed = now - bootStartRef.current;
    const remaining =
      elapsed >= MIN_MAP_BOOT_DISPLAY_MS
        ? 0
        : MIN_MAP_BOOT_DISPLAY_MS - elapsed;
    clearBootTimer();
    if (remaining === 0 || typeof window === "undefined") {
      setMapBooting(false);
      return;
    }
    if (typeof window !== "undefined") {
      bootTimerRef.current = window.setTimeout(() => {
        setMapBooting(false);
        bootTimerRef.current = null;
      }, remaining);
    }
  }, [clearBootTimer]);

  const markBootResized = useCallback(() => {
    if (mapResizedOnceRef.current) return;
    mapResizedOnceRef.current = true;
    finishBootIfReady();
  }, [finishBootIfReady]);
  const isDevEnv = Boolean((import.meta as any).env?.DEV);
  const storageDebugFlag =
    typeof window !== "undefined" &&
    window.localStorage.getItem("UQ_DEBUG_MAP") === "1";
  const debugMode = storageDebugFlag;
  const envDebugRaw = (import.meta as any).env?.VITE_UQ_MAP_DEBUG;
  const envDebugFlag =
    typeof envDebugRaw === "string" && envDebugRaw.toLowerCase() === "true";
  // Désactive le debug Mapbox par défaut (tiles, collision boxes, etc.)
  const debugEnabled = false; // Avant: envDebugFlag || storageDebugFlag
  const debugSource = envDebugFlag
    ? "env"
    : storageDebugFlag
    ? "localStorage"
    : "none";
  const diagnosticLoggingEnabled = isDevEnv || debugMode;

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
    const el = mapContainerRef.current;
    if (!el) return;
    if (mapRef.current) return;

    resetBootCycle();
    setMapBooting(true);
    setMapReady(false);
    setMapFailReason(null);
    setMapFailed(false);

    lastLoadStateTickRef.current = null;
    lastCanvasDebugRef.current = null;
    lastMapboxErrorRef.current = null;

    if (diagnosticLoggingEnabled) {
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

    const markFailure = (reason: string, userMessage?: string) => {
      if (failureReasonRef.current === reason) return;
      clearFailureTimer();
      failureReasonRef.current = reason;
      setMapFailReason(userMessage ?? getFriendlyFailureMessage(reason));
      clearBootTimer();
      setMapBooting(false);
      setMapReady(false);
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

    const userAgent =
      typeof navigator === "undefined" ? "" : navigator.userAgent || "";
    const safariDetected = Boolean(userAgent && isSafariUserAgent(userAgent));

    const storageBlockedMessage =
      "Le mode privé ou la protection des données bloque l'accès au stockage local. Quitte le mode privé pour afficher la carte.";
    const detectLocalStorageBlocked = () => {
      if (typeof window === "undefined") return false;
      try {
        window.localStorage.setItem(STORAGE_PROBE_KEY, "1");
        window.localStorage.removeItem(STORAGE_PROBE_KEY);
        return false;
      } catch (error) {
        if (diagnosticLoggingEnabled) {
          console.warn("[UQ][STORAGE_BLOCKED] localStorage blocked (Private Mode?)", error);
        }
        return true;
      }
    };
    let storageFailureNotified = false;
    const notifyStorageFailure = () => {
      if (storageFailureNotified) return;
      storageFailureNotified = true;
      markFailure("storage_blocked", storageBlockedMessage);
    };
    if (detectLocalStorageBlocked()) {
      notifyStorageFailure();
      return;
    }
    if (typeof window !== "undefined") {
      try {
        const idbFactory = window.indexedDB;
        if (idbFactory) {
          const request = idbFactory.open(STORAGE_PROBE_KEY, 1);
          request.onerror = () => {
            if (diagnosticLoggingEnabled) {
              console.warn(
                "[UQ][STORAGE_BLOCKED] indexedDB blocked (Private Mode?)",
                request.error
              );
            }
            notifyStorageFailure();
          };
          request.onsuccess = () => {
            const db = request.result;
            db?.close();
            idbFactory.deleteDatabase(STORAGE_PROBE_KEY);
          };
        }
      } catch (error) {
        if (diagnosticLoggingEnabled) {
          console.warn("[UQ][STORAGE_BLOCKED] IndexedDB probe error", error);
        }
      }
    }

    const ensureWebGLAvailable = () => {
      if (typeof window === "undefined") return true;
      const isMapboxSupported = mapboxgl.supported();
      let canvasHasContext = false;
      try {
        if (typeof document !== "undefined") {
          const testCanvas = document.createElement("canvas");
          canvasHasContext =
            Boolean(testCanvas.getContext("webgl")) ||
            Boolean(testCanvas.getContext("experimental-webgl"));
        }
      } catch (error) {
        console.warn("[UQ][WEBGL_CHECK_ERROR]", error);
      }
      if (diagnosticLoggingEnabled) {
        console.info(
          `[UQ][WEBGL_CHECK] mapboxSupported=${isMapboxSupported} canvasContext=${canvasHasContext} safari=${safariDetected}`
        );
      }
      if (!isMapboxSupported) {
        const message = safariDetected
          ? "WebGL est bloqué sur Safari, active-le dans les réglages avancés."
          : "WebGL est désactivé dans ce navigateur.";
        markFailure("webgl_context_unavailable", message);
        return false;
      }
      if (!canvasHasContext) {
        const message = safariDetected
          ? "Safari empêche la création d'un contexte WebGL. Autorise WebGL pour charger la carte."
          : "Impossible de créer un contexte WebGL.";
        markFailure("webgl_context_unavailable", message);
        return false;
      }
      return true;
    };

    if (!ensureWebGLAvailable()) {
      return;
    }

    const styleForMap = resolvedStyleUrlRef.current;
    lastStyleUrlRef.current = styleForMap;
    let mapInstance: mapboxgl.Map | null = null;
    if (diagnosticLoggingEnabled) {
      console.info("[UQ][MAP_INIT] started", {
        style: styleForMap,
        center: initialCenter,
        zoom: initialZoom,
        interactive,
      });
    }
    try {
      mapInstance = new mapboxgl.Map({
        container: el,
        style: styleForMap,
        center: initialCenter,
        zoom: initialZoom,
        interactive,
      });
    } catch (initError) {
      console.error("[UQ][MAP_INIT_ERR] Failed to initialize Mapbox", initError);
      const message =
        initError instanceof Error
          ? initError.message
          : String(initError ?? "unknown error");
      markFailure("init_error", `Impossible d'initialiser Mapbox : ${message}`);
      return;
    }
    if (!mapInstance) {
      markFailure(
        "init_error",
        "La création de la carte a échoué sans erreur explicite."
      );
      return;
    }
    const map = mapInstance;
    if (diagnosticLoggingEnabled) {
      console.info("[UQ][MAP_INIT] Mapbox instance ready");
    }
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
                markBootResized();
              } catch {
                // Resize may fail if map was removed.
              }
            }
          });
      });
    };

    if (diagnosticLoggingEnabled) {
      console.log("[UQ][MAPBOX_TOKEN_PRESENT]", Boolean(token));
    }

    const mapboxBlockedMessage =
      "Une extension, une politique CSP ou un token invalide empêche les requêtes Mapbox. Désactive le bloqueur ou vérifie le token.";
    const onError = (e: any) => {
      const blockedRequest = maybeLogMapboxRequestBlocked(
        e,
        safariDetected,
        diagnosticLoggingEnabled
      );
      if (diagnosticLoggingEnabled) {
        console.error("[UQ][MAPBOX_ERROR]", {
          message: e?.error?.message,
          status: e?.error?.status,
          url: e?.error?.url,
          sourceId: e?.sourceId,
          tile: e?.tile,
          raw: e,
        });
      }
      lastMapboxErrorRef.current = {
        status: e?.error?.status,
        url: e?.error?.url,
        message: e?.error?.message,
      };
      if (blockedRequest) {
        markFailure("mapbox_request_blocked", mapboxBlockedMessage);
        return;
      }
      markFailure("style_error");
    };

    const onStyleData = () => {
      console.log("[UQ][STYLE_DATA]");
    };

    const onLoad = () => {
      mapLoadedRef.current = true;
      console.log("[UQ][MAP_LOADED]");
      addDefaultControls();
      requestAnimationFrame(() => {
        try {
          map.resize();
          markBootResized();
        } catch {
          // Resize may fail if the map was removed early.
        }
      });
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
      setMapFailReason(null);
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
      clearBootTimer();
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
    clearBootTimer,
    markBootResized,
    resetBootCycle,
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
    setMapFailReason(null);
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

  const failureVariant = failureReasonRef.current
    ? FAILURE_VARIANTS[failureReasonRef.current]
    : undefined;
  const failureTitle = failureVariant?.title ?? "Carte indisponible";
  const failureCtaLabel = failureVariant?.ctaLabel;
  const handleFailureCta = () => {
    if (!failureVariant?.ctaUrl || typeof window === "undefined") return;
    window.open(failureVariant.ctaUrl, "_blank", "noopener");
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
  const failureSubtitle = mapFailReason || overlayMessage;
  const mapContainerClassName = className || "mapbox-container";
  const shellClassName = [
    "uq-map-shell",
    mapBooting ? "uq-map-shell--booting" : "",
    mapReady ? "uq-map-shell--ready" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div key={mapRetryKey} className={shellClassName}>
      <div
        ref={mapContainerRef}
        className={`uq-map-canvas ${mapContainerClassName}`}
      />
      {mapBooting && (
        <div className="uq-map-loading-overlay" aria-live="polite">
          <div className="uq-map-loading-card">
            <div className="uq-spinner" />
            <Skeleton className="panel-loading__line" />
            <Skeleton className="panel-loading__line" />
          </div>
        </div>
      )}
      {mapFailed && (
        <div className="uq-map-error-overlay" role="status" aria-live="polite">
          <div className="uq-map-loading-card">
            <div className="uq-map-loading-title">{failureTitle}</div>
            <div className="uq-map-loading-sub">{failureSubtitle}</div>
            {attemptLimitReached && (
              <small className="uq-map-error-note">
                3 tentatives max, pense à recharger.
              </small>
            )}
            <div className="uq-map-error-actions">
              <button
                type="button"
                onClick={() => {
                  if (buttonDisabled) return;
                  handleRetry();
                  window.location.reload();
                }}
                disabled={buttonDisabled}
              >
                {buttonLabel}
              </button>
              {failureCtaLabel && (
                <button
                  type="button"
                  className="uq-map-error-ghost"
                  onClick={handleFailureCta}
                >
                  {failureCtaLabel}
                </button>
              )}
              {debugMode && (
                <button
                  type="button"
                  onClick={copyDiagnostics}
                  className="uq-map-error-ghost"
                >
                  Copy diagnostics
                </button>
              )}
            </div>
            {debugMode && failureReason && (
              <small className="uq-map-error-note">reason={failureReason}</small>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
