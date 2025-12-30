import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import mapboxgl from "mapbox-gl";
import type { Feature, Point } from "geojson";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MapView from "../components/MapView";
import SearchBar from "../components/SearchBar";
import AddSpotDragHandle from "../components/map/AddSpotDragHandle";
import CreateSpotModal, {
  type SpotFormPayload,
} from "../components/map/CreateSpotModal";
import MapProPanel from "../components/map/MapProPanel";
import OverlayRenderer from "../components/OverlayRenderer";
import {
  listenGlobalMapLayout,
  saveGlobalMapLayout,
  resetGlobalMapLayout,
  DEFAULT_MAP_LAYOUT,
  MAP_LAYOUT_ZONE_KEYS,
  type MapLayoutBlockId,
  type MapLayoutPayload,
  type MapLayoutZoneKey,
  type MapLayoutZones,
} from "../services/layouts";
import {
  createPlace,
  listenPlaces,
  type Place,
  type SpotTier,
} from "../services/places";
import {
  DEFAULT_OVERLAY_VERSION,
  DEFAULT_UI_CONFIG,
  listenPublishedOverlay,
  listenPublishedUiConfig,
  type DeviceType,
  type MapStyleValue,
  type OverlayVersion,
  type UiConfig,
} from "../services/adminConfigs";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import { useLayoutEditMode } from "../hooks/useLayoutEditMode";
import { captureBreadcrumb } from "../lib/monitoring";
import { useAuthUI } from "../contexts/useAuthUI";

export type MapRouteProps = {
  nightVisionActive: boolean;
};

function normalizeBlockId(id: UniqueIdentifier | null): MapLayoutBlockId | null {
  if (id == null) return null;
  return String(id) as MapLayoutBlockId;
}

type ToastState = {
  message: string;
  type: "success" | "error";
};

type PopupStyle = {
  left: number;
  top: number;
  transform: string;
};

type DragState = {
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
};

const STYLE_URLS: Record<MapStyleValue, string> = {
  default: "mapbox://styles/mapbox/dark-v11",
  night: "mapbox://styles/mapbox/dark-v10",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

const SPOTS_SOURCE_ID = "uq-spots-source";
const SPOTS_LAYER_ID = "uq-spots-layer";

const TIER_LABELS: Record<SpotTier, string> = {
  STANDARD: "Standard",
  EPIC: "Epic",
  GHOST: "Ghost",
};

const TIER_ICONS: Record<SpotTier, string> = {
  STANDARD: "📍",
  EPIC: "👑",
  GHOST: "👻",
};

function getSpotTier(place: Place): SpotTier {
  if (place.tier === "EPIC") return "EPIC";
  if (place.tier === "GHOST") return "GHOST";
  if (place.isLegend) return "EPIC";
  if (place.isGhost) return "GHOST";
  return "STANDARD";
}

function isEpicSpot(place: Place) {
  return getSpotTier(place) === "EPIC";
}

function formatDistanceKm(coordsA: [number, number], coordsB: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(coordsB[1] - coordsA[1]);
  const dLon = toRad(coordsB[0] - coordsA[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coordsA[1])) *
      Math.cos(toRad(coordsB[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatRiskLevel(value?: string) {
  if (!value) return "Moyen";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAccess(value?: string) {
  if (!value) return "Moyen";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTimestampLabel(value?: number) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-CA", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDistanceLabel(value: number | null) {
  if (!value) return "—";
  return `${value.toFixed(1)} km`;
}

function getPlaceCoordinates(place: Place): [number, number] | null {
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return [lng, lat];
}

function placeToFeature(place: Place): Feature<Point> | null {
  const coordinates = getPlaceCoordinates(place);
  if (!coordinates) {
    return null;
  }
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates,
    },
    properties: {
      id: place.id,
      title: place.title ?? place.name ?? "",
      isEpic: isEpicSpot(place),
      isGhost: !!place.isGhost,
      tier: getSpotTier(place),
    },
  };
}

export default function MapRoute({ nightVisionActive }: MapRouteProps) {
  const { user, isPro, isAdmin, role } = useCurrentUserRole();
  const { requireAuth } = useAuthUI();
  const [places, setPlaces] = useState<Place[]>([]);
  const spotFeatures = useMemo(
    () =>
      places
        .map(placeToFeature)
        .filter(
          (feature): feature is Feature<Point> => feature !== null
        ),
    [places]
  );
  const [mapStyle, setMapStyle] = useState<MapStyleValue>("night");
  const [epicFilterActive, setEpicFilterActive] = useState(false);
  const [ghostFilterActive, setGhostFilterActive] = useState(false);
  const hostMode = false;
  const [uiConfig, setUiConfig] = useState<UiConfig>(DEFAULT_UI_CONFIG);
  const [overlayVersion, setOverlayVersion] = useState<OverlayVersion>(
    DEFAULT_OVERLAY_VERSION
  );
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const [mapZoom, setMapZoom] = useState(0);
  const deviceType: DeviceType = useMemo(() => {
    if (viewportWidth < 768) return "mobile";
    if (viewportWidth < 1024) return "tablet";
    return "desktop";
  }, [viewportWidth]);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [placingSpot, setPlacingSpot] = useState(false);
  const [dropCoords, setDropCoords] =
    useState<{ lat: number; lng: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const draftMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const markersMapRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [layoutZones, setLayoutZones] = useState<MapLayoutZones>(() =>
    cloneLayoutZones(DEFAULT_MAP_LAYOUT)
  );
  const [layoutMeta, setLayoutMeta] = useState<MapLayoutPayload | null>(null);
  const [draggingOverZone, setDraggingOverZone] = useState<MapLayoutZoneKey | null>(null);
  const [layoutEditMode, setLayoutEditMode] = useLayoutEditMode();
  const editingLayoutActive = isAdmin && layoutEditMode;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  const [mapReady, setMapReady] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const [spotsReady, setSpotsReady] = useState(false);
  const allReady = mapReady && containerReady && spotsReady;
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [activePinLngLat, setActivePinLngLat] = useState<[number, number] | null>(
    null
  );
  const [popupDetached, setPopupDetached] = useState(false);
  const [anchoredPopupStyle, setAnchoredPopupStyle] =
    useState<PopupStyle | null>(null);
  const [manualPopupStyle, setManualPopupStyle] = useState<PopupStyle | null>(
    null
  );
  const [popupDragging, setPopupDragging] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);


  const clearAllMarkers = useCallback((reason: string) => {
    if (markersMapRef.current.size === 0) {
      return;
    }
    console.log(`[UQ][PINS] clearing markers (${reason})`);
    markersMapRef.current.forEach((marker) => marker.remove());
    markersMapRef.current.clear();
  }, []);

  const applySpotFilters = useCallback(
    (markersToCheck: mapboxgl.Marker[] = Array.from(markersMapRef.current.values())) => {
      if (!markersToCheck || markersToCheck.length === 0) {
        return;
      }
      const showEpic = epicFilterActive;
      const showGhost = ghostFilterActive;
      const filtersActive = showEpic || showGhost;

      markersToCheck.forEach((marker) => {
        const element = marker.getElement();
        if (!element) return;
        const tierRaw = (element.dataset.tier ?? "STANDARD").toUpperCase();
        const markerTier: SpotTier =
          tierRaw === "EPIC" ? "EPIC" : tierRaw === "GHOST" ? "GHOST" : "STANDARD";

        let shouldDisplay = true;
        if (filtersActive) {
          if (showEpic && showGhost) {
            shouldDisplay = markerTier === "EPIC" || markerTier === "GHOST";
          } else if (showEpic) {
            shouldDisplay = markerTier === "EPIC";
          } else if (showGhost) {
            shouldDisplay = markerTier === "GHOST";
          }
        }
        element.style.display = shouldDisplay ? "" : "none";
      });
    },
    [epicFilterActive, ghostFilterActive]
  );

  const showToast = useCallback((message: string, type: ToastState["type"]) => {
    setToast({ message, type });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const handleMarkerClick = useCallback(
    (placeId: string, coords: [number, number]) => {
      setSelectedSpotId(placeId);
      setActivePinLngLat(coords);
      setPopupDetached(false);
      setManualPopupStyle(null);
      setAnchoredPopupStyle(null);
    },
    []
  );

  const selectedSpot = useMemo(() => {
    if (!selectedSpotId) return null;
    return places.find((place) => place.id === selectedSpotId) ?? null;
  }, [places, selectedSpotId]);

  const popupDistanceKm = useMemo(() => {
    if (!selectedSpot || !mapInstance) return null;
    const center = mapInstance.getCenter();
    const spotCoords: [number, number] = [selectedSpot.lng, selectedSpot.lat];
    return formatDistanceKm([center.lng, center.lat], spotCoords);
  }, [mapInstance, selectedSpot]);

  const popupDistanceLabel = formatDistanceLabel(popupDistanceKm);
  const lastSeenLabel = formatTimestampLabel(
    selectedSpot?.historyUpdatedAt ?? selectedSpot?.updatedAt
  );
  const selectedSpotTier = selectedSpot ? getSpotTier(selectedSpot) : "STANDARD";
  const selectedSpotTierLabel = TIER_LABELS[selectedSpotTier];
  const selectedSpotTierIcon = TIER_ICONS[selectedSpotTier];

  const isMobilePopup = deviceType === "mobile";
  const effectivePopupStyle = popupDetached
    ? manualPopupStyle ?? anchoredPopupStyle
    : anchoredPopupStyle;
  const computedPopupStyle = effectivePopupStyle
    ? {
        position: "fixed" as const,
        left: effectivePopupStyle.left,
        top: effectivePopupStyle.top,
        transform: effectivePopupStyle.transform,
        bottom: "auto",
        right: "auto",
      }
    : undefined;

  const handleItinerary = useCallback(() => {
    if (!selectedSpot || typeof window === "undefined") return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedSpot.lat},${selectedSpot.lng}`;
    window.open(url, "_blank");
  }, [selectedSpot]);
  
  const closeSpotPopup = useCallback(() => {
    setSelectedSpotId(null);
    setActivePinLngLat(null);
    setPopupDetached(false);
    setAnchoredPopupStyle(null);
    setManualPopupStyle(null);
    dragStateRef.current = null;
    setPopupDragging(false);
  }, []);

  const clampManualPosition = useCallback(
    (left: number, top: number, width: number, height: number) => {
      if (typeof window === "undefined") {
        return { left, top };
      }
      const padding = 8;
      const maxLeft = Math.max(padding, window.innerWidth - padding - width);
      const maxTop = Math.max(padding, window.innerHeight - padding - height);
      return {
        left: Math.min(Math.max(left, padding), maxLeft),
        top: Math.min(Math.max(top, padding), maxTop),
      };
    },
    []
  );

  const syncPopupToPin = useCallback(() => {
    if (
      !mapInstance ||
      !activePinLngLat ||
      popupDetached ||
      typeof window === "undefined"
    ) {
      return;
    }
    const popupEl = popupRef.current;
    const popupWidth = popupEl?.offsetWidth ?? 320;
    const popupHeight = popupEl?.offsetHeight ?? 280;
    const point = mapInstance.project({
      lng: activePinLngLat[0],
      lat: activePinLngLat[1],
    });
    const containerRect = mapInstance.getContainer().getBoundingClientRect();
    const baseLeft = containerRect.left + point.x;
    const baseTop = containerRect.top + point.y;
    const minSpace = 8;
    const horizontalOffset = 12;
    const defaultVerticalOffset = -42;
    const belowVerticalOffset = 18;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let anchorX = -0.5;
    let anchorY = -1;
    let offsetY = defaultVerticalOffset;
    const targetLeftBase = baseLeft + horizontalOffset;
    if (targetLeftBase - popupWidth / 2 < minSpace) {
      anchorX = 0;
    } else if (targetLeftBase + popupWidth / 2 > viewportWidth - minSpace) {
      anchorX = -1;
    }

    let targetTop = baseTop + offsetY;
    if (targetTop - popupHeight < minSpace) {
      anchorY = 0;
      offsetY = belowVerticalOffset;
      targetTop = baseTop + offsetY;
    }

    let targetLeft = targetLeftBase;
    const desiredLeft = targetLeft + anchorX * popupWidth;
    const maxLeft = Math.max(minSpace, viewportWidth - minSpace - popupWidth);
    const clampedLeft = Math.min(Math.max(desiredLeft, minSpace), maxLeft);
    targetLeft += clampedLeft - desiredLeft;

    const desiredTop = targetTop + anchorY * popupHeight;
    const maxTop = Math.max(minSpace, viewportHeight - minSpace - popupHeight);
    const clampedTop = Math.min(Math.max(desiredTop, minSpace), maxTop);
    targetTop += clampedTop - desiredTop;

    setAnchoredPopupStyle({
      left: targetLeft,
      top: targetTop,
      transform: `translate(${anchorX * 100}%, ${anchorY * 100}%)`,
    });
  }, [activePinLngLat, mapInstance, popupDetached]);

  useEffect(() => {
    if (!mapInstance || !activePinLngLat || popupDetached) {
      return;
    }
    const sync = () => {
      syncPopupToPin();
    };
    sync();
    mapInstance.on("move", sync);
    mapInstance.on("zoom", sync);
    mapInstance.on("resize", sync);
    return () => {
      mapInstance.off("move", sync);
      mapInstance.off("zoom", sync);
      mapInstance.off("resize", sync);
    };
  }, [activePinLngLat, mapInstance, popupDetached, syncPopupToPin]);

  const handlePopupPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(".map-spot-popup-close") ||
        target.closest(".map-spot-popup-reanchor")
      ) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      const rect = popupRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setManualPopupStyle({
        left: rect.left,
        top: rect.top,
        transform: "translate(0, 0)",
      });
      setPopupDetached(true);
      setPopupDragging(true);
      dragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
      };
    },
    []
  );

  useEffect(() => {
    if (!popupDragging || typeof document === "undefined") {
      return;
    }
    const handleMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) {
        return;
      }
      const popupEl = popupRef.current;
      const width = popupEl?.offsetWidth ?? 320;
      const height = popupEl?.offsetHeight ?? 280;
      const candidateLeft = state.startLeft + (event.clientX - state.startX);
      const candidateTop = state.startTop + (event.clientY - state.startY);
      const clamped = clampManualPosition(
        candidateLeft,
        candidateTop,
        width,
        height
      );
      setManualPopupStyle((prev) => ({
        left: clamped.left,
        top: clamped.top,
        transform: prev?.transform ?? "translate(0, 0)",
      }));
    };
    const handleUp = () => {
      setPopupDragging(false);
      dragStateRef.current = null;
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
  }, [clampManualPosition, popupDragging]);

  const handleReanchor = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setPopupDetached(false);
      setPopupDragging(false);
      setManualPopupStyle(null);
      dragStateRef.current = null;
    },
    []
  );

  const handlePlacesUpdate = useCallback(
    (items: Place[]) => {
      console.info("[UQ][PLACES_FETCH] received places", {
        count: items.length,
        isPro,
      });
      const features = items
        .map(placeToFeature)
        .filter(
          (feature): feature is Feature<Point> => feature !== null
        );
      console.log("[UQ][PINS] docs:", items.length);
      console.log("[UQ][PINS] valid:", features.length);
      if (features.length > 0) {
        console.log("[UQ][PINS] first:", features[0]);
      }
      captureBreadcrumb({
        message: "[UQ][PLACES_FETCH] success",
        category: "data.places",
        level: "info",
        data: { count: items.length, isPro },
      });
      setPlaces(items);
      setSpotsReady(true);
    },
    [isPro]
  );

  const handlePlacesError = useCallback(
    (error: unknown) => {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown");
      console.error("[UQ][PLACES_FETCH] failed", { message, error });
      captureBreadcrumb({
        message: "[UQ][PLACES_FETCH] error",
        category: "data.places",
        level: "error",
        data: { message },
      });
      showToast(
        "Impossible de charger la carte (App Check ou réseau).",
        "error"
      );
    },
    [showToast]
  );

  useEffect(() => {
    const unsubscribe = listenPlaces(
      handlePlacesUpdate,
      { isPro },
      handlePlacesError
    );
    return () => unsubscribe();
  }, [handlePlacesError, handlePlacesUpdate, isPro]);

  useEffect(() => {
    const unsubscribe = listenGlobalMapLayout((payload) => {
      setLayoutZones(cloneLayoutZones(payload?.zones ?? DEFAULT_MAP_LAYOUT));
      setLayoutMeta(payload ?? null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = listenPublishedUiConfig(
      "map-ui",
      (version) => {
        setUiConfig(version?.config ?? DEFAULT_UI_CONFIG);
      },
      (error) => console.error("[UQ][UI_CONFIG]", error)
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = listenPublishedOverlay(
      "map-overlays",
      (version) => {
        setOverlayVersion(version ?? DEFAULT_OVERLAY_VERSION);
      },
      (error) => console.error("[UQ][OVERLAY]", error)
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMapStyle(uiConfig.mapStyle === "default" ? "night" : uiConfig.mapStyle);
  }, [uiConfig.mapStyle]);

  useEffect(() => {
    if (!mapInstance) return;
    const updateZoom = () => {
      setMapZoom(mapInstance.getZoom());
    };
    mapInstance.on("move", updateZoom);
    updateZoom();
    return () => {
      mapInstance.off("move", updateZoom);
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance) {
      setMapReady(false);
      return;
    }
    if (mapInstance.isStyleLoaded?.()) {
      setMapReady(true);
      return;
    }
    setMapReady(false);
    const handleIdle = () => {
      setMapReady(true);
    };
    mapInstance.once("idle", handleIdle);
    return () => {
      mapInstance.off("idle", handleIdle);
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance) {
      setContainerReady(false);
      return;
    }
    const container = mapInstance.getContainer();
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerReady(rect.width > 0 && rect.height > 0);
    };
    updateSize();
    let observer: ResizeObserver | null = null;
    const ResizeObserverClass =
      typeof window !== "undefined" ? window.ResizeObserver : undefined;
    if (ResizeObserverClass) {
      observer = new ResizeObserverClass(updateSize);
      observer.observe(container);
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", updateSize);
    }
    return () => {
      observer?.disconnect();
      if (!observer && typeof window !== "undefined") {
        window.removeEventListener("resize", updateSize);
      }
    };
  }, [mapInstance]);

  useEffect(() => {
    if (mapInstance && mapReady && containerReady) {
      mapInstance.resize();
    }
  }, [mapInstance, mapReady, containerReady]);

  useEffect(() => {
    console.log(
      `[UQ][PINS] readiness gate mapReady=${mapReady} containerReady=${containerReady} spotsReady=${spotsReady}`
    );
  }, [mapReady, containerReady, spotsReady]);

  useEffect(() => {
    if (!mapInstance) return;
    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      console.log("[UQ][MAP] click", event.lngLat);
      if (selectedSpotId) {
        closeSpotPopup();
      }
    };
    mapInstance.on("click", handleMapClick);

    let layerAttached = false;
    const handleLayerClick = (event: mapboxgl.MapLayerMouseEvent) => {
      console.log("[UQ][SPOTS] layer click", event.features?.[0]?.properties);
    };
    const layerExists = !!mapInstance.getLayer(SPOTS_LAYER_ID);
    if (layerExists) {
      layerAttached = true;
      mapInstance.on("click", SPOTS_LAYER_ID, handleLayerClick);
    } else {
      console.warn("[UQ][SPOTS] layer missing:", SPOTS_LAYER_ID);
    }

    if (typeof window !== "undefined") {
      const overlay = document.querySelector<HTMLElement>(".map-overlay");
      const overlayPointer =
        overlay && window.getComputedStyle(overlay).pointerEvents;
      if (overlayPointer) {
        console.log("[UQ][MAP] overlay pointer-events", overlayPointer);
      }
      const canvas = mapInstance.getCanvas();
      const canvasPointer = window.getComputedStyle(canvas).pointerEvents;
      console.log("[UQ][MAP] canvas pointer-events", canvasPointer);
    }

    return () => {
      mapInstance.off("click", handleMapClick);
      if (layerAttached) {
        mapInstance.off("click", SPOTS_LAYER_ID, handleLayerClick);
      }
    };
  }, [mapInstance, closeSpotPopup, selectedSpotId]);

  useEffect(() => {
    applySpotFilters();
  }, [applySpotFilters]);

  useEffect(() => {
    if (typeof document === "undefined" || !uiConfig.accentColor) return;
    document.documentElement.style.setProperty(
      "--map-accent",
      uiConfig.accentColor
    );
  }, [uiConfig.accentColor]);

  const handleSelectPlace = useCallback((place: Place) => {
    void place;
  }, []);

  const handleSelectExternal = useCallback(
    (_lng: number, _lat: number, _label: string) => {
      void _lng;
      void _lat;
      void _label;
    },
    []
  );

  const viewSpotStory = useCallback((placeId: string) => {
    if (typeof window === "undefined") return;
    console.log("[UQ][SPOTS] selectedSpotId", placeId);
    window.dispatchEvent(
      new CustomEvent("urbex-nav", { detail: { path: `/spot/${placeId}` } })
    );
  }, []);

  const handleViewIndices = useCallback(() => {
    if (!selectedSpot) return;
    window.dispatchEvent(
      new CustomEvent("urbex-nav", {
        detail: { path: `/spot/${selectedSpot.id}/indices` },
      })
    );
  }, [selectedSpot]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);
  }, []);

  const handleStyleChange = useCallback((value: MapStyleValue) => {
    setMapStyle(value);
  }, []);

  const handleEpicToggle = useCallback(() => {
    setEpicFilterActive((prev) => !prev);
  }, []);

  const handleGhostToggle = useCallback(() => {
    setGhostFilterActive((prev) => !prev);
  }, []);

  const handleUnlockPro = useCallback(async () => {
    console.info("[analytics] pro_cta_click", { location: "map-bar" });
    if (!user) {
      await requireAuth({
        mode: "login",
        reason: "Connecte-toi pour débloquer PRO",
        redirectTo: "/pro",
      });
      return;
    }
    if (!isPro) {
      window.dispatchEvent(
        new CustomEvent("urbex-nav", { detail: { path: "/pro" } })
      );
    }
  }, [user, isPro, requireAuth]);

  const handleAddSpotActivate = useCallback(() => {
    setPlacingSpot((prev) => {
      const next = !prev;
      if (!next) {
        setDropCoords(null);
        setModalOpen(false);
      }
      return next;
    });
  }, []);

  const handlePlaceClick = useCallback(
    (event: mapboxgl.MapMouseEvent) => {
      setPlacingSpot(false);
      const lngLat = event.lngLat;
      setDropCoords({ lat: lngLat.lat, lng: lngLat.lng });
      setModalOpen(true);
    },
    []
  );

  useEffect(() => {
    const ensureLayer = () => {
      if (!mapInstance) return;
      if (!mapInstance.isStyleLoaded?.()) {
        return;
      }
      if (!mapInstance.getSource(SPOTS_SOURCE_ID)) {
        mapInstance.addSource(SPOTS_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: spotFeatures,
          },
        });
      }
      if (!mapInstance.getLayer(SPOTS_LAYER_ID)) {
        mapInstance.addLayer({
          id: SPOTS_LAYER_ID,
          type: "circle",
          source: SPOTS_SOURCE_ID,
          paint: {
            "circle-radius": 6,
            "circle-color": "#ff5fa2",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }
    };

    if (!mapInstance) {
      return;
    }
    ensureLayer();
    mapInstance.on("styledata", ensureLayer);
    return () => {
      mapInstance.off("styledata", ensureLayer);
    };
  }, [mapInstance, spotFeatures]);

  useEffect(() => {
    if (!mapInstance || !placingSpot) return;
    const canvas = mapInstance.getCanvas();
    canvas.style.cursor = "crosshair";
    mapInstance.on("click", handlePlaceClick);
    return () => {
      canvas.style.cursor = "";
      mapInstance.off("click", handlePlaceClick);
    };
  }, [mapInstance, placingSpot, handlePlaceClick]);

  useEffect(() => {
    if (!mapInstance || !dropCoords) return;
    const marker = new mapboxgl.Marker({
      color: "#ff5fa2",
    })
      .setLngLat([dropCoords.lng, dropCoords.lat])
      .addTo(mapInstance);
    draftMarkerRef.current = marker;
    return () => {
      marker.remove();
      draftMarkerRef.current = null;
    };
  }, [mapInstance, dropCoords]);

  useEffect(() => {
    if (!mapInstance) return;
    const source = mapInstance.getSource(
      SPOTS_SOURCE_ID
    ) as mapboxgl.GeoJSONSource | null;
    if (!source) {
      return;
    }
    source.setData({
      type: "FeatureCollection",
      features: spotFeatures,
    });
  }, [mapInstance, spotFeatures]);

  const ensureMarkers = useCallback(() => {
    if (!mapInstance) return;
    if (!allReady) {
      console.log(
        `[UQ][PINS] readiness gate block mapReady=${mapReady} containerReady=${containerReady} spotsReady=${spotsReady}`
      );
      return;
    }

    const mapMarkers = markersMapRef.current;
    const desiredIds = new Set<string>();
    let created = 0;
    let updated = 0;
    let invalid = 0;
    places.forEach((place) => {
      const coords = getPlaceCoordinates(place);
      if (!coords) {
        invalid += 1;
        console.warn(
          "[UQ][PINS] invalid coordinates for spot",
          place.id,
          place.lat,
          place.lng
        );
        return;
      }
      desiredIds.add(place.id);
      const existing = mapMarkers.get(place.id);
      if (existing) {
        existing.setLngLat(coords);
        updated += 1;
        return;
      }

      const element = document.createElement("div");
      element.className = "uq-pin";
      element.style.zIndex = "2";
      element.innerHTML = `
        <div class="uq-pin-inner">
          <span class="uq-pin-circle" aria-hidden="true">
            <span class="uq-pin-emoji">📍</span>
          </span>
        </div>
      `;
      element.setAttribute("title", place.title ?? place.name ?? "Spot");
      element.setAttribute("aria-label", place.title ?? place.name ?? "Spot");
      element.dataset.placeId = place.id;
      element.dataset.tier = getSpotTier(place);
      element.dataset.isEpic = isEpicSpot(place) ? "1" : "0";
      element.dataset.isGhost = place.isGhost ? "1" : "0";
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          handleMarkerClick(place.id, coords);
        });

      try {
        const marker = new mapboxgl.Marker(element).setLngLat(coords).addTo(
          mapInstance
        );
        mapMarkers.set(place.id, marker);
        created += 1;
      } catch (error) {
        console.error("[UQ][PIN_ADD_ERR]", error, place);
      }
    });

    const staleIds: string[] = [];
    mapMarkers.forEach((_marker, id) => {
      if (!desiredIds.has(id)) {
        staleIds.push(id);
      }
    });
    staleIds.forEach((id) => {
      const marker = mapMarkers.get(id);
      if (!marker) {
        return;
      }
      marker.remove();
      mapMarkers.delete(id);
      console.log(`[UQ][PINS] removed stale marker ${id}`);
    });

    console.log(
      `[UQ][PINS] markers sync (ensure) created=${created} updated=${updated} invalid=${invalid} total=${mapMarkers.size}`
    );
    applySpotFilters();
  }, [
    allReady,
    applySpotFilters,
    containerReady,
    mapInstance,
    mapReady,
    handleMarkerClick,
    places,
    spotsReady,
  ]);

  useEffect(() => {
    ensureMarkers();
  }, [ensureMarkers]);

  useEffect(() => {
    if (!selectedSpotId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSpotPopup();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedSpotId, closeSpotPopup]);

  useEffect(() => {
    if (!selectedSpotId) return;
    const exists = places.some((place) => place.id === selectedSpotId);
    if (!exists) {
      closeSpotPopup();
    }
  }, [places, selectedSpotId, closeSpotPopup]);

  useEffect(() => {
    return () => {
      clearAllMarkers("map-instance-unmount");
    };
  }, [mapInstance, clearAllMarkers]);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setDropCoords(null);
  }, []);

  const handleSpotSubmit = useCallback(
    async (payload: SpotFormPayload) => {
      if (!dropCoords) {
        const missingCoordsError = new Error("Coordonnées manquantes");
        showToast("Coordonnées manquantes", "error");
        throw missingCoordsError;
      }
      const coords = { lat: dropCoords.lat, lng: dropCoords.lng };
      const context = {
        title: payload.title,
        category: payload.category,
        riskLevel: payload.riskLevel,
        tier: payload.tier,
        coords,
        photoCount: payload.photos.length,
        userId: user?.uid ?? "guest",
      };
      console.info("[UQ][ADD_SPOT] submit", context);
      captureBreadcrumb({
        message: "[UQ][ADD_SPOT] submit",
        category: "add-spot",
        level: "info",
        data: context,
      });
      try {
        const docId = await createPlace({
          title: payload.title,
          description: payload.description,
          category: payload.category,
          riskLevel: payload.riskLevel,
          tier: payload.tier,
          photos: payload.photos,
          blurRadius: payload.blurRadius,
          accessNotes: payload.accessNotes,
          storySteps: payload.storySteps,
          lootTags: payload.lootTags,
          tags: payload.lootTags,
          access: payload.access,
          lat: coords.lat,
          lng: coords.lng,
          isPublic: true,
          addedBy: context.userId,
        });
        if (mapInstance) {
          mapInstance.flyTo({
            center: [coords.lng, coords.lat],
            zoom: Math.max(mapInstance.getZoom(), 12),
          });
        }
        console.info("[UQ][ADD_SPOT] success", { docId, ...context });
        captureBreadcrumb({
          message: "[UQ][ADD_SPOT] success",
          category: "add-spot",
          level: "info",
          data: { docId, ...context },
        });
        showToast("Spot ajouté sur la carte", "success");
        return docId;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible d’ajouter le spot.";
        const code = (error as { code?: string | number }).code;
        const failureData = {
          ...context,
          code: code ?? null,
          message,
        };
        console.error("[UQ][ADD_SPOT] failure", failureData, error);
        captureBreadcrumb({
          message: "[UQ][ADD_SPOT] failure",
          category: "add-spot",
          level: "error",
          data: failureData,
        });
        showToast(
          `Erreur lors de l’ajout${code ? ` (${code})` : ""}: ${message}`,
          "error"
        );
        throw error;
      }
    },
    [dropCoords, mapInstance, showToast, user?.uid]
  );

  const persistLayout = useCallback(
    (zones: MapLayoutZones) => {
      void saveGlobalMapLayout(zones, user?.uid ?? null).catch((error) => {
        console.error("[UQ][MAP_LAYOUT_SAVE]", error);
      });
    },
    [user?.uid]
  );

  const handleLayoutReset = useCallback(() => {
    setLayoutZones(cloneLayoutZones(DEFAULT_MAP_LAYOUT));
    void resetGlobalMapLayout(user?.uid ?? null).catch((error) => {
      console.error("[UQ][MAP_LAYOUT_RESET]", error);
    });
  }, [user?.uid]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setDraggingOverZone(getZoneFromDroppableId(event.over?.id ?? null));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingOverZone(null);
      const activeId = normalizeBlockId(event.active?.id ?? null);
      if (!activeId) {
        return;
      }
      const overId = normalizeBlockId(event.over?.id ?? null);
      if (!overId) {
        return;
      }
      setLayoutZones((prev) => {
        const next = applyDropToLayout(prev, activeId, overId);
        if (!next) {
          return prev;
        }
        persistLayout(next);
        return next;
      });
    },
    [persistLayout]
  );

  const renderBlockContent = useCallback(
    (blockId: MapLayoutBlockId, editing: boolean): ReactNode => {
      switch (blockId) {
        case "search":
          return (
            <div className="map-search-wrapper">
              <div className="map-search-panel">
                <SearchBar
                  places={places}
                  onSelectPlace={handleSelectPlace}
                  onSelectExternal={handleSelectExternal}
                  isProUser={isPro}
                />
              </div>
            </div>
          );
        case "proBar":
          return (
            <div className="map-pro-bar-wrap">
              <div className="map-pro-bar">
                {isPro ? (
                  <MapProPanel
                    styleValue={mapStyle}
                    onStyleChange={handleStyleChange}
                    epicFilterActive={epicFilterActive}
                    ghostFilterActive={ghostFilterActive}
                    onEpicToggle={handleEpicToggle}
                    onGhostToggle={handleGhostToggle}
                  />
                ) : (
                  <button
                    type="button"
                    className="map-pro-bar-unlock"
                    onClick={handleUnlockPro}
                  >
                    👑 Débloquer PRO
                  </button>
                )}
              </div>
            </div>
          );
        case "hostBadge":
          if (!hostMode && !editing) {
            return null;
          }
          return hostMode ? (
            <div className="map-host-badge">Host mode activé</div>
          ) : (
            <div className="map-layout-placeholder">Badge host désactivé</div>
          );
        case "spotHandle":
          return (
            <div className="map-add-spot-block">
              <AddSpotDragHandle onActivate={handleAddSpotActivate} active={placingSpot} />
              {placingSpot && (
                <div className="map-place-instructions">
                  Cliquez sur la carte pour déposer un pin
                </div>
              )}
            </div>
          );
        default:
          return null;
      }
    },
      [ 
      handleAddSpotActivate,
      handleEpicToggle,
      handleGhostToggle,
      handleSelectExternal,
      handleSelectPlace,
      handleStyleChange,
      handleUnlockPro,
      hostMode,
      isPro,
      mapStyle,
      placingSpot,
      places,
      epicFilterActive,
      ghostFilterActive,
    ]
  );

  const renderZones = useCallback(
    (editing: boolean) => {
      return MAP_LAYOUT_ZONE_KEYS.map((zone) => {
        const zoneBlocks = (layoutZones[zone] ?? []).filter(isBlockId);
        if (!editing && zoneBlocks.length === 0) {
          return null;
        }
        const zoneElement = (
          <MapLayoutZone
            key={zone}
            zone={zone}
            blocks={zoneBlocks}
            isEditing={editing}
            draggingOver={draggingOverZone}
            renderBlock={(blockId) => renderBlockContent(blockId, editing)}
          />
        );
        if (!editing) {
          return zoneElement;
        }
        return (
          <SortableContext
            key={zone}
            items={zoneBlocks}
            strategy={rectSortingStrategy}
          >
            {zoneElement}
          </SortableContext>
        );
      });
    },
    [draggingOverZone, layoutZones, renderBlockContent]
  );

  return (
    <div className="route-map">
      <div className="map-shell">
        <div className="map-canvas">
          <MapView
            nightVisionActive={nightVisionActive}
            styleUrl={STYLE_URLS[mapStyle]}
            onMapReady={handleMapReady}
          />
        </div>
        <div className="map-overlay">
          {editingLayoutActive ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setDraggingOverZone(null)}
            >
              {renderZones(true)}
            </DndContext>
          ) : (
            <>{renderZones(false)}</>
          )}
          {editingLayoutActive && (
            <div className="map-layout-editor-actions">
              <div>
                <p className="map-layout-editor-actions__title">Mode édition layout</p>
                {layoutMeta?.updatedAt && (
                  <p className="map-layout-editor-actions__meta">
                    Dernière sauvegarde le{" "}
                    {new Date(layoutMeta.updatedAt).toLocaleString("fr-CA")}
                    {layoutMeta.updatedBy ? ` par ${layoutMeta.updatedBy}` : ""}
                  </p>
                )}
              </div>
              <div className="map-layout-editor-actions__buttons">
                <button type="button" className="urbex-btn urbex-btn-secondary" onClick={handleLayoutReset}>
                  Réinitialiser
                </button>
                <button type="button" className="urbex-btn urbex-btn-primary" onClick={() => setLayoutEditMode(false)}>
                  Quitter
                </button>
              </div>
            </div>
          )}
          <CreateSpotModal
            open={modalOpen}
            coords={dropCoords}
            onClose={handleModalClose}
            onSubmit={handleSpotSubmit}
            isPro={isPro}
          />
        </div>
        <div className="map-overlay-layer" aria-hidden="true">
          <OverlayRenderer
            components={overlayVersion.components}
            role={role}
            device={deviceType}
            viewportWidth={viewportWidth}
            mapZoom={mapZoom}
            mapStyle={mapStyle}
          />
        </div>
        {selectedSpotId && (
          <div
            className={`map-spot-popup-root ${
              isMobilePopup ? "map-spot-popup-root--mobile" : ""
            }`}
            aria-live="polite"
            role="dialog"
          >
            <div
              ref={popupRef}
              className={`map-spot-popup ${
                isMobilePopup ? "map-spot-popup--mobile" : ""
              } uq-spot-popup ${selectedSpot ? "uq-spot-popup--visible" : ""}`}
              style={computedPopupStyle}
            >
              <div className="uq-spot-popup-card">
                <button
                  type="button"
                  className="map-spot-popup-close uq-spot-popup-close"
                  onClick={closeSpotPopup}
                  aria-label="Fermer l’information du spot"
                >
                  ×
                </button>
                {selectedSpot ? (
                  <>
                    {selectedSpot.historyImages &&
                    selectedSpot.historyImages.length > 0 ? (
                      <div className="uq-spot-popup-media">
                        <img
                          src={selectedSpot.historyImages[0]}
                          alt={selectedSpot.title ?? "Spot UrbexQueens"}
                        />
                      </div>
                    ) : null}
                    <div className="uq-spot-popup-body">
                      <div
                        className={`uq-spot-popup-header-row ${
                          popupDragging ? "is-dragging" : ""
                        }`}
                        onPointerDown={handlePopupPointerDown}
                      >
                        <span
                          className={`uq-spot-popup-tier-pill tier-${selectedSpotTier.toLowerCase()}`}
                        >
                          {selectedSpotTierLabel}
                        </span>
                        <div className="uq-spot-popup-titles">
                          <div className="uq-spot-popup-title-row">
                            <h3 className="uq-spot-popup-title">
                              {selectedSpot.title ?? selectedSpot.name ?? "Spot"}
                            </h3>
                            <span className="uq-spot-popup-icon">
                              {selectedSpotTierIcon}
                            </span>
                          </div>
                          <p className="uq-spot-popup-category">
                            {selectedSpot.category ?? "Autre"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="map-spot-popup-reanchor"
                          aria-label="Replacer le popup sur le pin"
                          onClick={handleReanchor}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          📍
                        </button>
                      </div>
                      <div className="uq-spot-popup-meta-grid">
                        <div>
                          <span className="uq-spot-popup-label">Risque</span>
                          <span className="uq-spot-popup-meta">
                            {formatRiskLevel(selectedSpot.riskLevel)}
                          </span>
                        </div>
                        <div>
                          <span className="uq-spot-popup-label">Accès</span>
                          <span className="uq-spot-popup-meta">
                            {formatAccess(selectedSpot.access)}
                          </span>
                        </div>
                        <div>
                          <span className="uq-spot-popup-label">Dernière vue</span>
                          <span className="uq-spot-popup-meta">
                            {lastSeenLabel}
                          </span>
                        </div>
                        <div>
                          <span className="uq-spot-popup-label">Distance</span>
                          <span className="uq-spot-popup-meta">
                            {popupDistanceLabel}
                          </span>
                        </div>
                      </div>
                      <div className="uq-spot-popup-actions">
                        <button
                          type="button"
                          className="uq-spot-popup-btn uq-spot-popup-btn--primary"
                          onClick={() => viewSpotStory(selectedSpot.id)}
                        >
                          Fiche
                        </button>
                        <button
                          type="button"
                          className="uq-spot-popup-btn uq-spot-popup-btn--secondary"
                          onClick={handleItinerary}
                        >
                          Itinéraire
                        </button>
                        {isPro && (
                          <button
                            type="button"
                            className="uq-spot-popup-btn uq-spot-popup-btn--ghost"
                            onClick={handleViewIndices}
                          >
                            Indices
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="map-spot-popup-loading">
                    Chargement de l’endroit...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {toast && (
          <div className={`map-toast is-visible map-toast--${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}

const ZONE_LABELS: Record<MapLayoutZoneKey, string> = {
  top: "Zone supérieure",
  left: "Zone gauche",
  right: "Zone droite",
  bottomRight: "Zone inférieure",
  floating: "Zone flottante",
};

const BLOCK_LABELS: Record<MapLayoutBlockId, string> = {
  search: "Barre de recherche",
  proBar: "Barre PRO",
  hostBadge: "Badge Host",
  spotHandle: "Ajouter un spot",
};

type MapLayoutBlockProps = {
  id: MapLayoutBlockId;
  isEditing: boolean;
  children: ReactNode;
};

function MapLayoutBlock({ id, isEditing, children }: MapLayoutBlockProps) {
  if (!isEditing) {
    return (
      <div className="map-layout-block" data-block-id={id}>
        {children}
      </div>
    );
  }

  return (
    <EditableMapLayoutBlock id={id}>
      {children}
    </EditableMapLayoutBlock>
  );
}

type EditableMapLayoutBlockProps = {
  id: MapLayoutBlockId;
  children: ReactNode;
};

function EditableMapLayoutBlock({ id, children }: EditableMapLayoutBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={`map-layout-block ${isDragging ? "is-dragging" : ""}`}
      style={style}
      data-block-id={id}
      {...attributes}
    >
      <button
        type="button"
        className="map-layout-drag-handle"
        aria-label={`Déplacer ${BLOCK_LABELS[id]}`}
        {...listeners}
      >
        ⠿
      </button>
      {children}
    </div>
  );
}

type MapLayoutZoneProps = {
  zone: MapLayoutZoneKey;
  blocks: MapLayoutBlockId[];
  isEditing: boolean;
  draggingOver: MapLayoutZoneKey | null;
  renderBlock: (blockId: MapLayoutBlockId, editing: boolean) => ReactNode | null;
};

function MapLayoutZone({
  zone,
  blocks,
  isEditing,
  draggingOver,
  renderBlock,
}: MapLayoutZoneProps) {
  const { setNodeRef } = useDroppable({ id: `zone:${zone}` });
  const blockNodes = blocks
    .map((blockId) => {
      const content = renderBlock(blockId, isEditing);
      if (!content) {
        return null;
      }
      return (
        <MapLayoutBlock key={`${zone}-${blockId}`} id={blockId} isEditing={isEditing}>
          {content}
        </MapLayoutBlock>
      );
    })
    .filter((node): node is ReactElement => Boolean(node));
  const hasBlocks = blockNodes.length > 0;
  const showEmpty = isEditing && !hasBlocks;

  return (
    <div
      ref={isEditing ? setNodeRef : undefined}
      className={`map-zone map-zone-${zone} ${isEditing ? "is-editing" : ""} ${
        draggingOver === zone ? "is-dragging-over" : ""
      }`}
      data-zone={zone}
    >
      {isEditing && (
        <div className="map-zone-label">
          <span>{ZONE_LABELS[zone]}</span>
        </div>
      )}
      <div className={zone === "top" ? "map-header" : "map-zone-body"}>
        {blockNodes}
        {showEmpty && (
          <div className="map-zone-empty">
            <span>Glissez une section ici</span>
          </div>
        )}
      </div>
    </div>
  );
}

function isBlockId(value: unknown): value is MapLayoutBlockId {
  return typeof value === "string" && value in BLOCK_LABELS;
}

function cloneLayoutZones(zones: MapLayoutZones): MapLayoutZones {
  const next = {} as MapLayoutZones;
  MAP_LAYOUT_ZONE_KEYS.forEach((zone) => {
    next[zone] = Array.isArray(zones[zone]) ? [...zones[zone]] : [];
  });
  return next;
}

function findZoneForBlock(
  zones: MapLayoutZones,
  blockId: MapLayoutBlockId
): MapLayoutZoneKey | null {
  for (const zone of MAP_LAYOUT_ZONE_KEYS) {
    if ((zones[zone] ?? []).includes(blockId)) {
      return zone;
    }
  }
  return null;
}

function getZoneFromDroppableId(id: UniqueIdentifier | null): MapLayoutZoneKey | null {
  if (id == null) return null;
  const normalized = String(id);
  if (!normalized.startsWith("zone:")) {
    return null;
  }
  const zone = normalized.replace("zone:", "") as MapLayoutZoneKey;
  return MAP_LAYOUT_ZONE_KEYS.includes(zone) ? zone : null;
}

function moveBlockBetweenZones(
  zones: MapLayoutZones,
  fromZone: MapLayoutZoneKey,
  toZone: MapLayoutZoneKey,
  blockId: MapLayoutBlockId,
  insertBefore?: MapLayoutBlockId | null
): MapLayoutZones {
  const next = cloneLayoutZones(zones);
  next[fromZone] = next[fromZone].filter((id) => id !== blockId);
  const targetList = [...next[toZone]];
  let insertIndex = targetList.length;
  if (insertBefore) {
    const idx = targetList.indexOf(insertBefore);
    if (idx !== -1) {
      insertIndex = idx;
    }
  }
  targetList.splice(insertIndex, 0, blockId);
  next[toZone] = targetList;
  return next;
}

function applyDropToLayout(
  zones: MapLayoutZones,
  blockId: MapLayoutBlockId,
  overId: string
): MapLayoutZones | null {
  const sourceZone = findZoneForBlock(zones, blockId);
  if (!sourceZone) {
    return null;
  }
  const dropZone = getZoneFromDroppableId(overId);
  const overIdString = String(overId);
  const isBlock = isBlockId(overIdString);

  if (dropZone && !isBlock) {
    return moveBlockBetweenZones(zones, sourceZone, dropZone, blockId, null);
  }

  const targetBlock = isBlock ? (overId as MapLayoutBlockId) : null;
  const targetZone = targetBlock ? findZoneForBlock(zones, targetBlock) : null;

  if (!targetZone) {
    return null;
  }

  if (sourceZone === targetZone && targetBlock) {
    const list = zones[sourceZone];
    const fromIndex = list.indexOf(blockId);
    const toIndex = list.indexOf(targetBlock);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return null;
    }
    return {
      ...zones,
      [sourceZone]: arrayMove(list, fromIndex, toIndex),
    };
  }

  return moveBlockBetweenZones(
    zones,
    sourceZone,
    targetZone,
    blockId,
    targetBlock
  );
}
