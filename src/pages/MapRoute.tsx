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
import { geohashQueryBounds, distanceBetween } from "geofire-common";
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
import TimeRiftPanel, { type HistoryMode } from "../components/map/TimeRiftPanel";
import ProModal from "../components/ProModal";
import ProDashboardPanel from "../components/ProDashboardPanel";
import WelcomeBanner from "../components/WelcomeBanner";
import GuestLimitModalManager from "../components/GuestLimitModalManager";
import SpotListsModal from "../components/SpotListsModal";
import OverlayRenderer from "../components/OverlayRenderer";
import UQImage from "../components/UQImage";
import { SpotPopupSkeleton } from "../components/skeletons/SkeletonVariants";
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
  listenPlaces,
  queryPlacesByGeohashRange,
  shouldDisplayTier,
  type Place,
  type SpotTier,
  type UserLevel,
} from "../services/places";
import { submitSpotSubmission } from "../services/spotSubmissions";
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
import {
  listenUserPlaces,
  setPlaceDone,
  setPlaceSaved,
  type UserPlaceState,
  type UserPlacesMap,
} from "../services/userPlaces";
import { awardXpForEvent } from "../services/gamification";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import useInteractionPulse from "../hooks/useInteractionPulse";
import { useLayoutEditMode } from "../hooks/useLayoutEditMode";
import { useOptimisticAction } from "../hooks/useOptimisticAction";
import { captureBreadcrumb } from "../lib/monitoring";
import { validateLatLng } from "../lib/validation";
import {
  SPOT_LISTS_EVENT,
  type SpotListView,
} from "../lib/userSpotStats";
import { useAuthUI } from "../contexts/useAuthUI";
import { useToast } from "../contexts/useToast";
import { triggerHapticFeedback } from "../utils/haptics";
import type { MapRouteProps } from "./MapRoute.types";
import { setupGhostEchoLayers } from "../examples/markerIntegration";
import { ensureMapboxIcons, setupStyleImageMissing } from "../utils/mapboxIcons";
import { useMapPerformanceMonitor } from "../hooks/useMapPerformanceMonitor";
import { usePerformanceSettings } from "../hooks/usePerformanceSettings";
import PerformanceHUD from "../components/PerformanceHUD";
import PerformanceControls from "../components/PerformanceControls";
// 🕰️ TIME RIFT V4: Archive Intelligence helpers
import {
  type EraBucket,
  isIntelligenceModeEnabled,
  filterSpotsByBucket as _filterSpotsByBucket, // Step 4 (Overlay)
  spotsToGeoJSON, // Step 4 (Overlay)
  getSpotYear, // Step 4 (Debug)
} from "../utils/timeRiftIntelligence";
import {
  getSpotTier,
  formatDistanceKm,
  formatRiskLevel,
  formatAccess,
  formatTimestampLabel,
  formatDistanceLabel,
  placeToFeature,
} from "./MapRoute.helpers";

function normalizeBlockId(id: UniqueIdentifier | null): MapLayoutBlockId | null {
  if (id == null) return null;
  return String(id) as MapLayoutBlockId;
}

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

type DebugFetchStats = {
  fetchedTiles: number;
  fetchedDocs: number;
  inFlight: number;
  lastQueryMs: number;
};

const STYLE_URLS: Record<MapStyleValue, string> = {
  default: "mapbox://styles/mapbox/dark-v11",
  night: "mapbox://styles/mapbox/dark-v10",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

const CLUSTER_SOURCE_ID = "uq-spots-clustered";
const PLAIN_SOURCE_ID = "uq-spots-plain";
const CLUSTER_LAYER_CIRCLES_ID = "uq-cluster-circles";
const CLUSTER_LAYER_COUNT_ID = "uq-cluster-count";
const CLUSTER_LAYER_IDS = [CLUSTER_LAYER_CIRCLES_ID, CLUSTER_LAYER_COUNT_ID];
const PLAIN_LAYER_IDS = ["spots-circle", "spots-icon"];

// 🕰️ TIME RIFT V4 STEP 4: Intelligence Overlay constants
const TIME_RIFT_INTEL_SOURCE_ID = "uq-time-rift-intel";
const TIME_RIFT_INTEL_HEATMAP_ID = "uq-time-rift-intel-heatmap";
const TIME_RIFT_INTEL_GLOW_ID = "uq-time-rift-intel-glow";

// ═══════════════════════════════════════════════════════════════
// ROUTE PLANNER: All interactive pin layers for click handlers
// ═══════════════════════════════════════════════════════════════
const PIN_INTERACTIVE_LAYER_IDS = ["spots-icon", "spots-circle"] as const;

const GEOHASH_IDLE_DELAY = 520;
// const QA_PRO_PANEL_ENABLED = import.meta.env.VITE_ENABLE_E2E_HOOKS === "1";
const DEBUG_FETCH_STATS_ENABLED = import.meta.env.DEV;

const TIER_LABELS: Record<SpotTier, string> = {
  STANDARD: "Standard",
  EPIC: "Epic",
  GHOST: "Ghost",
};

// const TIER_ICONS: Record<SpotTier, string> = {
//   STANDARD: "📍",
//   EPIC: "👑",
//   GHOST: "👻",
// };

export default function MapRoute({ nightVisionActive }: MapRouteProps) {
  const { user, isPro, isAdmin, role } = useCurrentUserRole();
  const isGuest = !user;
  const showProFilters = true; // Temporaire: activé pour tous pour tester
  const { requireAuth } = useAuthUI();
  
  // Déterminer le niveau utilisateur pour le filtrage des spots
  const userLevel: UserLevel = isPro ? "pro" : (user ? "member" : "guest");
  
  const [places, setPlaces] = useState<Place[]>([]);
  const [mapStyle, setMapStyle] = useState<MapStyleValue>("night");
  const [epicFilterActive, setEpicFilterActive] = useState(false);
  const [ghostFilterActive, setGhostFilterActive] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [proDashboardOpen, setProDashboardOpen] = useState(false);
  
  // 🎯 Nouvelles options PRO map
  // 🔍 CLUSTER: Load preference from localStorage (normal prod behavior)
  const [clusteringEnabled, setClusteringEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("urbex-clustering-enabled");
      if (import.meta.env.DEV) {
        console.log("[CLUSTER INIT] localStorage value:", stored);
      }
      return stored === "true";
    } catch {
      return false;
    }
  });
  const handleClusterToggle = useCallback(() => {
    setClusteringEnabled((prev) => {
      const next = !prev;
      if (import.meta.env.DEV && typeof window !== "undefined") {
        try {
          const stored = window.localStorage.getItem("urbex-clustering-enabled");
          console.log(
            `[CLUSTER] toggle before=${prev} after=${next} storage=${stored}`
          );
        } catch (error) {
          console.warn("[CLUSTER] toggle storage read failed", error);
        }
      }
      return next;
    });
  }, []);
  
  // ✅ FIX 2: Sync ref with state immediately (before INIT runs)
  const clusteringEnabledRef = useRef(clusteringEnabled);
  useEffect(() => {
    clusteringEnabledRef.current = clusteringEnabled;
    if (import.meta.env.DEV) {
      console.log("[CLUSTER REF] Synced ref with state:", clusteringEnabled);
    }
  }, [clusteringEnabled]);
  
  // Track if layers are ready (initialized and style loaded)
  const layersReadyRef = useRef(false);
  
  // ✅ Anti-race guard: Track init run ID to prevent async completion out-of-order
  const initRunIdRef = useRef(0);
  
  // Version counter to force re-binding of handlers after style.load
  const [layersVersion, setLayersVersion] = useState(0);
  const [routePlannerActive, setRoutePlannerActive] = useState(false);
  const [routeWaypoints, setRouteWaypoints] = useState<Place[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);
  
  // 🕰️ TIME RIFT (History mode - PRO only, no data needed)
  const [historyActive, setHistoryActive] = useState(false);
  const [historyMode, setHistoryMode] = useState<HistoryMode>("archives");
  const [historyYear, setHistoryYear] = useState(2025);

  // 🕰️ TIME RIFT V4: Archive Intelligence state (feature flag gated)
  const [timeRiftEra, setTimeRiftEra] = useState<EraBucket>("all");
  const [_timeRiftOverlayEnabled, setTimeRiftOverlayEnabled] = useState(false); // Step 4 (Overlay)

  // 🕰️ TIME RIFT: Memoize decay GeoJSON (avoid rebuild on every mode/year change)
  const decayGeoJSON = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: places.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { id: p.id },
      })),
    };
  }, [places]);
  
  // ═══════════════════════════════════════════════════════════════
  // ANTI-STALE: Refs to capture reactive state in event handlers
  // ═══════════════════════════════════════════════════════════════
  const routePlannerActiveRef = useRef(routePlannerActive);
  const isProRef = useRef(isPro);
  const placesRef = useRef(places);
  
  // Keep refs in sync with state
  useEffect(() => {
    routePlannerActiveRef.current = routePlannerActive;
  }, [routePlannerActive]);
  
  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);
  
  useEffect(() => {
    placesRef.current = places;
  }, [places]);
  
  const [advancedFiltersActive, setAdvancedFiltersActive] = useState(false);
  const [showRouteToast, setShowRouteToast] = useState(false);
  
  // 🔍 DIAGNOSTIC: Trace ALL state changes (detect concurrent setters)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[ROUTE][STATE_CHANGE]", routePlannerActive);
      if (routePlannerActive) {
        console.log("📍 ROUTE planner activé - Sélectionnez des spots pour créer un itinéraire");
      } else {
        console.log("📍 ROUTE planner désactivé");
      }
    }
  }, [routePlannerActive]);

  // 🕰️ TIME RIFT V4 DEBUG: Intelligence Mode Gating
  useEffect(() => {
    if (import.meta.env.DEV) {
      const flagEnabled = isIntelligenceModeEnabled();
      const showChip = flagEnabled && isPro;
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🕰️ TIME RIFT V4 - INTELLIGENCE MODE DIAGNOSTIC");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 ENV FLAG:", import.meta.env.VITE_TIME_RIFT_INTELLIGENCE_ENABLED);
      console.log("🔧 isIntelligenceModeEnabled():", flagEnabled);
      console.log("👑 isPro:", isPro);
      console.log("👤 User:", user?.email || "guest");
      console.log("🎯 showIntelligenceMode (chip visible):", showChip);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      if (!flagEnabled) {
        console.warn("⚠️ FLAG OFF → Enable in .env.local: VITE_TIME_RIFT_INTELLIGENCE_ENABLED=true");
      } else if (!isPro) {
        console.warn("⚠️ USER NOT PRO → Intelligence chip hidden (PRO required)");
      } else {
        console.log("✅ INTELLIGENCE MODE AVAILABLE → 🧠 chip should be visible");
      }
    }
  }, [isPro, user]);
  
  // ═══════════════════════════════════════════════════════════════
  // UX FAIL-SAFE: Show toast when ROUTE activated, hide after 3s or first waypoint
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (routePlannerActive && isPro && routeWaypoints.length === 0) {
      setShowRouteToast(true);
      const timer = setTimeout(() => setShowRouteToast(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowRouteToast(false);
    }
  }, [routePlannerActive, isPro, routeWaypoints.length]);
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      if (advancedFiltersActive) {
        console.log("🎯 FILTER avancés activés - Catégorie, risque, accessibilité");
      } else {
        console.log("🎯 FILTER avancés désactivés");
      }
    }
  }, [advancedFiltersActive]);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    const status = clusteringEnabled ? "activé" : "désactivé";
    const storedValue = String(clusteringEnabled);
    if (import.meta.env.DEV) {
      console.log(`🔍 CLUSTER ${status} stored=${storedValue}`);
    }
    try {
      window.localStorage.setItem("urbex-clustering-enabled", storedValue);
    } catch (err) {
      console.warn("[CLUSTER] Failed to save preference:", err);
    }
  }, [clusteringEnabled]);
  
  const filteredPlaces = useMemo(() => {
    if (!epicFilterActive && !ghostFilterActive) {
      return places;
    }
    return places.filter((place) =>
      shouldDisplayTier(
        getSpotTier(place),
        epicFilterActive,
        ghostFilterActive
      )
    );
  }, [places, epicFilterActive, ghostFilterActive]);
  
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
  
  // ⚡ PERFORMANCE: Monitoring & Settings (after mapInstance declaration)
  const { settings: perfSettings } = usePerformanceSettings();
  const perfMetrics = useMapPerformanceMonitor(
    mapInstance,
    PLAIN_SOURCE_ID,
    perfSettings.performanceHUDEnabled
  );
  
  const [userPlaces, setUserPlaces] = useState<UserPlacesMap>({});
  const {
    state: optimisticUserPlaces,
    applyOptimistic: applyOptimisticUserPlaces,
    commit: commitUserPlaceAction,
  } = useOptimisticAction("spotActions", userPlaces);
  
  // Filter out "done" spots from main map (they go to "Spots Faits" view)
  // Keep "saved" spots visible with ❤️ pin
  const explorationPlaces = useMemo(
    () => filteredPlaces.filter((place) => !optimisticUserPlaces[place.id]?.done),
    [filteredPlaces, optimisticUserPlaces]
  );
  
  // spotFeatures for map rendering (exploration mode: excludes done spots)
  const spotFeatures = useMemo(
    () =>
      explorationPlaces
        .map((place) => placeToFeature(place, optimisticUserPlaces, isPro))
        .filter(
          (feature): feature is Feature<Point> => feature !== null
        ),
    [explorationPlaces, optimisticUserPlaces, isPro]
  );
  
  const toast = useToast();
  const patchSpotState = useCallback(
    (placeId: string, patch: Partial<UserPlaceState>) =>
      applyOptimisticUserPlaces((previous) => {
        const next = { ...previous };
        const current = previous[placeId] ?? {};
        next[placeId] = {
          ...current,
          ...patch,
        };
        return next;
      }),
    [applyOptimisticUserPlaces]
  );
  const [pendingSpotAction, setPendingSpotAction] = useState<string | null>(null);
  const [donePulseActive, triggerDonePulse] = useInteractionPulse(360);
  const [savedPulseActive, triggerSavedPulse] = useInteractionPulse(360);
  const [spotListsOpen, setSpotListsOpen] = useState(false);
  const [spotListsView, setSpotListsView] = useState<SpotListView | null>(null);
  const [proUnlockPulseActive, triggerProUnlockPulse] = useInteractionPulse(360);
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
  const [mapReadyForListeners, setMapReadyForListeners] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
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
  const selectedSpotIdRef = useRef<string | null>(null);


  useEffect(() => {
    if (!user?.uid) {
      setUserPlaces({});
      return;
    }
    const unsubscribe = listenUserPlaces(user.uid, setUserPlaces);
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const handleSpotListsEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ view: SpotListView }>;
      setSpotListsView(customEvent.detail.view);
      setSpotListsOpen(true);
    };
    window.addEventListener(SPOT_LISTS_EVENT, handleSpotListsEvent);
    return () => window.removeEventListener(SPOT_LISTS_EVENT, handleSpotListsEvent);
  }, []);

  const handleMarkerClick = useCallback(
    (placeId: string, coords: [number, number]) => {
      setSelectedSpotId(placeId);
      selectedSpotIdRef.current = placeId;
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
  // const selectedSpotTierIcon = TIER_ICONS[selectedSpotTier]; // Retiré du popup, gardé pour référence
  const selectedSpotState = selectedSpot
    ? optimisticUserPlaces[selectedSpot.id]
    : undefined;
  const spotMarkedDone = !!selectedSpotState?.done;
  const spotSaved = !!selectedSpotState?.saved;

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
    selectedSpotIdRef.current = null;
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
      toast.error("Impossible de charger la carte (App Check ou réseau).");
    },
    [toast]
  );

  const placesByIdRef = useRef<Map<string, Place>>(new Map());
  const loadedRangesRef = useRef<Set<string>>(new Set());
  const geohashRequestIdRef = useRef(0);
  const geohashFetchTimerRef = useRef<number | null>(null);
  const pendingRangesRef = useRef<Set<string>>(new Set());
  const [debugFetchStats, setDebugFetchStats] = useState<DebugFetchStats>({
    fetchedTiles: 0,
    fetchedDocs: 0,
    inFlight: 0,
    lastQueryMs: 0,
  });

  const mergePlaces = useCallback(
    (items: Place[]) => {
      if (items.length === 0) {
        return;
      }
      const map = placesByIdRef.current;
      items.forEach((place) => {
        map.set(place.id, place);
      });
      setPlaces(Array.from(map.values()));
    },
    [setPlaces]
  );

  const loadVisiblePlaces = useCallback(async () => {
    if (!mapInstance) {
      return;
    }
    const bounds = mapInstance.getBounds();
    if (!bounds || bounds.isEmpty()) {
      return;
    }
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const centerLat = (sw.lat + ne.lat) / 2;
    const centerLng = (sw.lng + ne.lng) / 2;
    const radiusKm = Math.max(
      distanceBetween([centerLat, centerLng], [ne.lat, ne.lng]),
      0.001
    );
    const radiusMeters = Math.max(radiusKm * 1000, 50);
    const ranges = geohashQueryBounds([centerLat, centerLng], radiusMeters);
    if (ranges.length === 0) {
      return;
    }

    const rangesToFetch: { range: [string, string]; key: string }[] = [];
    const rangeKeys: string[] = [];

    ranges.forEach((range) => {
      const key = `${range[0]}|${range[1]}`;
      if (
        loadedRangesRef.current.has(key) ||
        pendingRangesRef.current.has(key)
      ) {
        return;
      }
      pendingRangesRef.current.add(key);
      rangesToFetch.push({ range, key });
      rangeKeys.push(key);
    });

    if (rangesToFetch.length === 0) {
      return;
    }

    const requestId = ++geohashRequestIdRef.current;
    const startTime =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now();
    setDebugFetchStats((prev) => ({
      ...prev,
      inFlight: prev.inFlight + rangesToFetch.length,
    }));
    const fetchResults = await Promise.allSettled(
      rangesToFetch.map(({ range }) =>
        queryPlacesByGeohashRange(range, { 
          isPro,
          userLevel,
          userId: user?.uid || null,
          guestLimit: 3,
        })
      )
    );
    const endTime =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now();
    const lastQueryMs = Math.max(0, Math.round(endTime - startTime));

    rangesToFetch.forEach(({ key }) => {
      pendingRangesRef.current.delete(key);
    });
    setDebugFetchStats((prev) => ({
      ...prev,
      inFlight: Math.max(
        prev.inFlight - rangesToFetch.length,
        0
      ),
      lastQueryMs,
    }));

    if (requestId !== geohashRequestIdRef.current) {
      return;
    }

    const successfulRanges: { key: string; places: Place[] }[] = [];
    fetchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successfulRanges.push({
          key: rangesToFetch[index].key,
          places: result.value,
        });
      }
    });

    const combinedPlaces = successfulRanges.flatMap(({ places }) => places);
    successfulRanges.forEach(({ key }) => {
      loadedRangesRef.current.add(key);
    });
    if (combinedPlaces.length > 0) {
      mergePlaces(combinedPlaces);
    }

    setDebugFetchStats((prev) => ({
      ...prev,
      fetchedTiles: prev.fetchedTiles + successfulRanges.length,
      fetchedDocs: prev.fetchedDocs + combinedPlaces.length,
    }));

    const failedRange = fetchResults.find(
      (result) => result.status === "rejected"
    );
    if (failedRange) {
      const reason = failedRange.reason;
      console.error("[UQ][PLACES_FETCH] range failed", {
        reason,
      });
      captureBreadcrumb({
        message: "[UQ][PLACES_FETCH] tile error",
        category: "data.places",
        level: "error",
        data: {
          error:
            reason instanceof Error
              ? reason.message
              : String(reason ?? "unknown"),
          ranges: rangeKeys.length,
        },
      });
      handlePlacesError(reason);
    } else {
      captureBreadcrumb({
        message: "[UQ][PLACES_FETCH] tile success",
        category: "data.places",
        level: "info",
        data: {
          ranges: rangeKeys.length,
          count: combinedPlaces.length,
          isPro,
        },
      });
    }
  }, [handlePlacesError, isPro, mapInstance, mergePlaces]);

  const scheduleVisibleTileFetch = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (geohashFetchTimerRef.current) {
      window.clearTimeout(geohashFetchTimerRef.current);
    }
    geohashFetchTimerRef.current = window.setTimeout(() => {
      void loadVisiblePlaces();
    }, GEOHASH_IDLE_DELAY);
  }, [loadVisiblePlaces]);

  useEffect(() => {
    if (!mapReadyForListeners) {
      return;
    }
    const unsubscribe = listenPlaces(
      (items) => {
        const legacyPlaces = items.filter((place) => !place.geohash);
        if (legacyPlaces.length === 0) {
          return;
        }
        mergePlaces(legacyPlaces);
      },
      {
        isPro,
        userLevel,
        userId: user?.uid || null,
        guestLimit: 3,
      },
      handlePlacesError
    );
    return () => unsubscribe();
  }, [
    handlePlacesError,
    isPro,
    mapReadyForListeners,
    userLevel,
    user?.uid,
    mergePlaces,
  ]);

  useEffect(() => {
    if (!mapInstance) {
      return;
    }
    const handleMapIdle = () => {
      scheduleVisibleTileFetch();
      setMapReadyForListeners(true);
    };
    mapInstance.on("idle", handleMapIdle);
    return () => {
      mapInstance.off("idle", handleMapIdle);
      if (
        geohashFetchTimerRef.current &&
        typeof window !== "undefined"
      ) {
        window.clearTimeout(geohashFetchTimerRef.current);
        geohashFetchTimerRef.current = null;
      }
    };
  }, [mapInstance, scheduleVisibleTileFetch]);

  useEffect(() => {
    if (!mapInstance || !mapReady) {
      return;
    }
    scheduleVisibleTileFetch();
  }, [mapInstance, mapReady, scheduleVisibleTileFetch]);

  useEffect(() => {
    if (!mapReadyForListeners) {
      return;
    }
    const unsubscribe = listenGlobalMapLayout((payload) => {
      setLayoutZones(cloneLayoutZones(payload?.zones ?? DEFAULT_MAP_LAYOUT));
      setLayoutMeta(payload ?? null);
    });
    return () => unsubscribe();
  }, [mapReadyForListeners]);

  useEffect(() => {
    if (!mapReadyForListeners) {
      return;
    }
    const unsub = listenPublishedUiConfig(
      "map-ui",
      (version) => {
        setUiConfig(version?.config ?? DEFAULT_UI_CONFIG);
      },
      (error) => console.error("[UQ][UI_CONFIG]", error)
    );
    return unsub;
  }, [mapReadyForListeners]);

  useEffect(() => {
    if (!mapReadyForListeners) {
      return;
    }
    const unsub = listenPublishedOverlay(
      "map-overlays",
      (version) => {
        setOverlayVersion(version ?? DEFAULT_OVERLAY_VERSION);
      },
      (error) => console.error("[UQ][OVERLAY]", error)
    );
    return unsub;
  }, [mapReadyForListeners]);

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
    setMapReadyForListeners(false);
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
    if (!mapInstance) return;

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      if (import.meta.env.DEV) {
        console.log("[UQ][MAP] click", event.lngLat);
      }
      if (selectedSpotIdRef.current) {
        closeSpotPopup();
      }
    };

    const handleUnclusteredClick = (
      event: mapboxgl.MapLayerMouseEvent
    ) => {
      const feature = event.features?.[0];
      
      // ═══════════════════════════════════════════════════════════════
      // ROBUST ID RESOLUTION: Try properties.id, properties.placeId, then feature.id
      // ═══════════════════════════════════════════════════════════════
      const resolvedId = 
        (typeof feature?.properties?.id === "string" ? feature.properties.id : null) ||
        (typeof feature?.properties?.placeId === "string" ? feature.properties.placeId : null) ||
        (typeof feature?.id === "string" ? feature.id : null);
      
      if (import.meta.env.DEV) {
        console.log("[UQ][SPOTS] pin click", {
          layerId: feature?.layer?.id,
          propertiesKeys: feature?.properties ? Object.keys(feature.properties) : [],
          resolvedId,
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // ROUTE PLANNER: Add waypoint instead of opening popup (PRO ONLY)
      // ═══════════════════════════════════════════════════════════════
      const isRouteActive = routePlannerActiveRef.current;
      const userIsPro = isProRef.current;
      
      // HARD GUARANTEE: If ROUTE active + PRO, NEVER open popup (even if place not found)
      if (isRouteActive && userIsPro) {
        if (!resolvedId) {
          if (import.meta.env.DEV) {
            console.warn("[ROUTE] No feature ID found - cannot add waypoint");
          }
          return; // Block popup
        }

        const clickedPlace = placesRef.current.find((p) => p.id === resolvedId);
        
        if (import.meta.env.DEV) {
          console.log("[ROUTE] Click captured:", {
            routePlannerActive: isRouteActive,
            isPro: userIsPro,
            layerId: feature?.layer?.id,
            resolvedId,
            foundPlace: !!clickedPlace,
          });
        }

        if (!clickedPlace) {
          if (import.meta.env.DEV) {
            console.warn("[ROUTE] Place not found for id:", resolvedId);
          }
          return; // Block popup
        }

        setRouteWaypoints((prev) => {
          // If already selected, remove it (toggle behavior)
          if (prev.some((p) => p.id === resolvedId)) {
            if (import.meta.env.DEV) {
              console.log("[ROUTE] Removed waypoint:", clickedPlace.title);
            }
            return prev.filter((p) => p.id !== resolvedId);
          }

          // Limit to 5 waypoints (MVP strict)
          if (prev.length >= 5) {
            if (import.meta.env.DEV) {
              console.warn("[ROUTE] Max 5 waypoints reached");
            }
            return prev;
          }

          if (import.meta.env.DEV) {
            console.log("[ROUTE] Added waypoint:", clickedPlace.title);
          }
          return [...prev, clickedPlace];
        });
        return; // Don't open popup when route planner active
      }

      // Normal behavior: open popup (only if NOT in ROUTE mode)
      if (!resolvedId) {
        console.warn("[UQ][SPOTS] pin click - no feature ID found");
        return;
      }
      
      console.log("[UQ][SPOTS] opening popup for spot:", resolvedId);
      handleMarkerClick(resolvedId, [event.lngLat.lng, event.lngLat.lat]);
    };

    const handleLayerEnter = () => {
      const canvas = mapInstance.getCanvas();
      canvas.style.cursor = "pointer";
    };

    const handleLayerLeave = () => {
      const canvas = mapInstance.getCanvas();
      canvas.style.cursor = "";
    };

    const attachPinEvents = () => {
      // ═══════════════════════════════════════════════════════════════
      // Attach click handlers to ALL interactive pin layers
      // ═══════════════════════════════════════════════════════════════
      PIN_INTERACTIVE_LAYER_IDS.forEach((layerId) => {
        if (mapInstance.getLayer(layerId)) {
          // Remove existing handlers (idempotent)
          mapInstance.off("click", layerId, handleUnclusteredClick);
          mapInstance.off("mouseenter", layerId, handleLayerEnter);
          mapInstance.off("mouseleave", layerId, handleLayerLeave);
          
          // Attach new handlers
          mapInstance.on("click", layerId, handleUnclusteredClick);
          mapInstance.on("mouseenter", layerId, handleLayerEnter);
          mapInstance.on("mouseleave", layerId, handleLayerLeave);
        }
      });
    };

    const handleStyleData = () => {
      attachPinEvents();
    };

    mapInstance.on("click", handleMapClick);
    attachPinEvents();
    mapInstance.on("styledata", handleStyleData);

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
      
      // Detach from all pin layers
      PIN_INTERACTIVE_LAYER_IDS.forEach((layerId) => {
        mapInstance.off("click", layerId, handleUnclusteredClick);
        mapInstance.off("mouseenter", layerId, handleLayerEnter);
        mapInstance.off("mouseleave", layerId, handleLayerLeave);
      });
      
      mapInstance.off("styledata", handleStyleData);
    };
  }, [mapInstance, closeSpotPopup, handleMarkerClick]);
  // Note: routePlannerActive, places, isPro read via refs (anti-stale pattern)

  useEffect(() => {
    if (typeof document === "undefined" || !uiConfig.accentColor) return;
    document.documentElement.style.setProperty(
      "--map-accent",
      uiConfig.accentColor
    );

    // ✅ Update route layer colors when accent changes (reactive)
    if (mapInstance) {
      const routeLayer = mapInstance.getLayer("route-line-layer");
      const waypointsLayer = mapInstance.getLayer("route-waypoints-layer");
      
      if (routeLayer) {
        mapInstance.setPaintProperty("route-line-layer", "line-color", uiConfig.accentColor);
      }
      if (waypointsLayer) {
        mapInstance.setPaintProperty("route-waypoints-layer", "circle-color", uiConfig.accentColor);
      }
      
      if (import.meta.env.DEV && (routeLayer || waypointsLayer)) {
        console.log("[ROUTE] Updated colors to:", uiConfig.accentColor);
      }
    }
  }, [uiConfig.accentColor, mapInstance]);

  // ═══════════════════════════════════════════════════════════════
  // ROUTE PLANNER: Simple LRU cache (max 20 entries)
  // ═══════════════════════════════════════════════════════════════
  const routeCacheRef = useRef<Map<string, GeoJSON.LineString>>(new Map());
  const ROUTE_CACHE_MAX_SIZE = 20;

  const getCachedRoute = useCallback((key: string): GeoJSON.LineString | null => {
    return routeCacheRef.current.get(key) || null;
  }, []);

  const setCachedRoute = useCallback((key: string, geometry: GeoJSON.LineString) => {
    const cache = routeCacheRef.current;
    
    // LRU: Remove oldest entry if cache full
    if (cache.size >= ROUTE_CACHE_MAX_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    
    // Delete key first (to re-insert at end = most recent)
    cache.delete(key);
    cache.set(key, geometry);
    
    if (import.meta.env.DEV) {
      console.log(`[ROUTE CACHE] Stored key: ${key} (total: ${cache.size})`);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // ROUTE PLANNER: Mapbox Directions API helper (MVP strict + cache)
  // ═══════════════════════════════════════════════════════════════
  const fetchRouteGeometry = useCallback(async (
    waypoints: Place[],
    signal?: AbortSignal
  ): Promise<GeoJSON.LineString | null> => {
    if (waypoints.length < 2) return null;
    
    const coordinates = waypoints.map(p => `${p.lng},${p.lat}`).join(";");
    const cacheKey = `driving:${coordinates}`;
    
    // ✅ Check cache first
    const cached = getCachedRoute(cacheKey);
    if (cached) {
      if (import.meta.env.DEV) {
        console.log("[ROUTE] Cache HIT:", cacheKey);
      }
      return cached;
    }
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`;
    
    try {
      const response = await fetch(url, { signal });
      
      if (!response.ok) {
        if (response.status === 401) {
          if (import.meta.env.DEV) {
            console.error("[ROUTE] Mapbox token invalid or unauthorized");
          }
        } else if (response.status === 429) {
          if (import.meta.env.DEV) {
            console.warn("[ROUTE] Rate limit exceeded, try again later");
          }
        }
        return null;
      }
      
      const data = await response.json();
      const geometry = data.routes?.[0]?.geometry || null;
      
      // ✅ Store in cache
      if (geometry) {
        setCachedRoute(cacheKey, geometry);
      }
      
      return geometry;
    } catch (error: any) {
      if (error.name === "AbortError") {
        // Silent abort (expected when waypoints change rapidly)
        return null;
      }
      if (import.meta.env.DEV) {
        console.error("[ROUTE] Directions API error:", error);
      }
      return null;
    }
  }, [getCachedRoute, setCachedRoute]);

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

  const handleToggleDone = useCallback(async () => {
    console.log("[MapRoute] handleToggleDone called", { 
      hasSelectedSpot: !!selectedSpot, 
      hasUser: !!user,
      spotMarkedDone 
    });
    
    if (!selectedSpot) {
      console.error("[MapRoute] toggle done: no selectedSpot");
      return;
    }
    if (!user) {
      console.log("[MapRoute] toggle done: requireAuth needed");
      await requireAuth({
        mode: "login",
        reason: "Connecte-toi pour marquer un spot comme fait",
      });
      return;
    }

    const nextDone = !spotMarkedDone;
    console.log("[MapRoute] toggle done START", {
      spotId: selectedSpot.id,
      userId: user.uid,
      currentDone: spotMarkedDone,
      nextDone,
    });
    setPendingSpotAction("done");
    patchSpotState(selectedSpot.id, { done: nextDone });
    try {
      await commitUserPlaceAction(
        setPlaceDone(user.uid, selectedSpot.id, nextDone, {
          metadata: {
            tier: selectedSpotTier,
            riskLevel: selectedSpot.riskLevel,
            timestamp: Date.now(),
          },
          isPro,
        })
      );
      console.log("[MapRoute] toggle done SUCCESS");
      if (nextDone) {
        await awardXpForEvent(user.uid, "mark_done", { isPro });
        triggerDonePulse();
        triggerHapticFeedback();
      }
      toast.success(
        nextDone
          ? "Spot ajouté à ton carnet des faits"
          : "Spot retiré de ton carnet"
      );
    } catch (error) {
      console.error("[MapRoute] toggle done ERROR", error);
      toast.warning("Action annulée");
    } finally {
      setPendingSpotAction(null);
    }
  }, [
    user,
    selectedSpot,
    spotMarkedDone,
    selectedSpotTier,
    isPro,
    requireAuth,
    toast,
    triggerDonePulse,
    patchSpotState,
    commitUserPlaceAction,
  ]);

  const handleToggleSaved = useCallback(async () => {
    console.log("[MapRoute] handleToggleSaved called", { 
      hasSelectedSpot: !!selectedSpot, 
      hasUser: !!user,
      spotSaved 
    });
    
    if (!selectedSpot) {
      console.error("[MapRoute] toggle saved: no selectedSpot");
      return;
    }
    if (!user) {
      console.log("[MapRoute] toggle saved: requireAuth needed");
      await requireAuth({
        mode: "login",
        reason: "Connecte-toi pour enregistrer un favori",
      });
      return;
    }

    const nextSaved = !spotSaved;
    console.log("[MapRoute] toggle saved START", {
      spotId: selectedSpot.id,
      userId: user.uid,
      currentSaved: spotSaved,
      nextSaved,
    });
    setPendingSpotAction("saved");
    patchSpotState(selectedSpot.id, { saved: nextSaved });
    try {
      await commitUserPlaceAction(setPlaceSaved(user.uid, selectedSpot.id, nextSaved));
      console.log("[MapRoute] toggle saved SUCCESS");
      if (nextSaved) {
        await awardXpForEvent(user.uid, "save_spot", { isPro });
        triggerSavedPulse();
        triggerHapticFeedback();
      }
      toast.success(
        nextSaved ? "Spot ajouté aux favoris" : "Favori retiré"
      );
    } catch (error) {
      console.error("[MapRoute] toggle saved ERROR", error);
      toast.warning("Action annulée");
    } finally {
      setPendingSpotAction(null);
    }
  }, [
    user,
    selectedSpot,
    spotSaved,
    isPro,
    requireAuth,
    toast,
    triggerSavedPulse,
    patchSpotState,
    commitUserPlaceAction,
  ]);

  const handleSpotListsClose = useCallback(() => {
    setSpotListsOpen(false);
  }, []);

  const handleSpotListsViewChange = useCallback((view: SpotListView) => {
    setSpotListsView(view);
  }, []);

  const handleSelectPlaceFromList = useCallback((place: Place) => {
    setSelectedSpotId(place.id);
    selectedSpotIdRef.current = place.id;
    setActivePinLngLat([place.lng, place.lat]);
    setSpotListsOpen(false);
  }, []);

  const handleToggleDoneFromList = useCallback(
    async (place: Place) => {
      if (!user) {
        await requireAuth({
          mode: "login",
          reason: "Connecte-toi pour marquer un spot comme fait",
        });
        return;
      }

      const currentState = optimisticUserPlaces[place.id]?.done || false;
      const nextDone = !currentState;
      
      patchSpotState(place.id, { done: nextDone });
      try {
        await commitUserPlaceAction(
          setPlaceDone(user.uid, place.id, nextDone, {
            metadata: {
              tier: place.tier,
              riskLevel: place.riskLevel,
              timestamp: Date.now(),
            },
            isPro,
          })
        );
        if (nextDone) {
          await awardXpForEvent(user.uid, "mark_done", { isPro });
          triggerDonePulse();
          triggerHapticFeedback();
        }
        toast.success(
          nextDone
            ? "Spot ajouté à ton carnet des faits"
            : "Spot retiré de ton carnet"
        );
      } catch (error) {
        console.error("[MapRoute] toggle done from list", error);
        toast.warning("Action annulée");
      }
    },
    [
      user,
      optimisticUserPlaces,
      isPro,
      requireAuth,
      toast,
      triggerDonePulse,
      patchSpotState,
      commitUserPlaceAction,
    ]
  );

  const handleToggleSavedFromList = useCallback(
    async (place: Place) => {
      if (!user) {
        await requireAuth({
          mode: "login",
          reason: "Connecte-toi pour enregistrer un favori",
        });
        return;
      }

      const currentState = optimisticUserPlaces[place.id]?.saved || false;
      const nextSaved = !currentState;
      
      patchSpotState(place.id, { saved: nextSaved });
      try {
        await commitUserPlaceAction(setPlaceSaved(user.uid, place.id, nextSaved));
        if (nextSaved) {
          await awardXpForEvent(user.uid, "save_spot", { isPro });
          triggerSavedPulse();
          triggerHapticFeedback();
        }
        toast.success(
          nextSaved ? "Spot ajouté aux favoris" : "Favori retiré"
        );
      } catch (error) {
        console.error("[MapRoute] toggle saved from list", error);
        toast.warning("Action annulée");
      }
    },
    [
      user,
      optimisticUserPlaces,
      isPro,
      requireAuth,
      toast,
      triggerSavedPulse,
      patchSpotState,
      commitUserPlaceAction,
    ]
  );

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

  const handleUnlockPro = useCallback(() => {
    console.info("[analytics] pro_cta_click", { location: "map-bar" });
    triggerProUnlockPulse();
    // Ouvrir le modal PRO directement (connexion demandée au moment du paiement)
    setProModalOpen(true);
  }, [triggerProUnlockPulse]);

  const handleOpenProDashboard = useCallback(() => {
    setProDashboardOpen(true);
  }, []);

  const handleCloseProDashboard = useCallback(() => {
    setProDashboardOpen(false);
  }, []);

  const handleWelcomeSignup = useCallback(async () => {
    await requireAuth({
      mode: "signup",
      reason: "Créé ton compte pour rejoindre la communauté",
    });
  }, [requireAuth]);

  const handleWelcomeLogin = useCallback(async () => {
    await requireAuth({
      mode: "login",
      reason: "Connecte-toi pour accéder à tes spots",
    });
  }, [requireAuth]);

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

  // ═══════════════════════════════════════════════════════════════
  // CALLBACK: Initialize spot sources and layers (structural operations)
  // ═══════════════════════════════════════════════════════════════
  const initializeSpotSources = useCallback(async () => {
    if (!mapInstance) return;
    
    // ✅ Anti-race: Increment run ID and capture locally
    initRunIdRef.current += 1;
    const currentRunId = initRunIdRef.current;
    
    if (import.meta.env.DEV) {
      console.log(`[INIT] Starting run #${currentRunId}`);
    }
    
    // Check if style is loaded before any structural operations
    if (!mapInstance.isStyleLoaded()) {
      console.log(`[INIT] Style not loaded yet (run #${currentRunId}), will retry on style.load`);
      
      // ✅ Anti-race: Create retry callbacks that check run ID before executing
      const retryInit = () => {
        // Check if this retry is still valid (not superseded by newer run)
        if (currentRunId !== initRunIdRef.current) {
          console.warn(`[INIT] ⚠️ Retry from run #${currentRunId} aborted (superseded by #${initRunIdRef.current})`);
          return;
        }
        initializeSpotSources();
      };
      
      // ✅ PLAN B: Retry when style loads (more reliable than "load" after setStyle)
      mapInstance.once("style.load", retryInit);
      // ✅ PLAN C: Backup with "idle" event (fires after style.load)
      mapInstance.once("idle", retryInit);
      return;
    }

    // ✅ CRITICAL: Ensure Mapbox icons are loaded BEFORE creating layers
    // This prevents "Image 'heart-15' could not be loaded" warnings + flash
    try {
      await ensureMapboxIcons(mapInstance, { verbose: import.meta.env.DEV });
      
      // ✅ Anti-race check: Abort if another run started while we were awaiting
      if (currentRunId !== initRunIdRef.current) {
        console.warn(`[INIT] ⚠️ Run #${currentRunId} aborted (superseded by #${initRunIdRef.current})`);
        return;
      }
      
      console.log(`[INIT] ✅ All Mapbox icons loaded (run #${currentRunId})`);
    } catch (error) {
      console.error("[INIT] ❌ Failed to load Mapbox icons:", error);
      // Continue anyway, styleimagemissing will catch missing icons
    }

    // Empty GeoJSON for initialization (data updated separately)
    const emptyFeatureCollection = {
      type: "FeatureCollection" as const,
      features: [],
    };

    // Create sources if they don't exist (guarded)
    if (!mapInstance.getSource(CLUSTER_SOURCE_ID)) {
      mapInstance.addSource(CLUSTER_SOURCE_ID, {
        type: "geojson",
        data: emptyFeatureCollection,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      if (import.meta.env.DEV) {
        console.log("[INIT] Created cluster source");
      }
    }

    if (!mapInstance.getSource(PLAIN_SOURCE_ID)) {
      mapInstance.addSource(PLAIN_SOURCE_ID, {
        type: "geojson",
        data: emptyFeatureCollection,
        cluster: false,
      });
      if (import.meta.env.DEV) {
        console.log("[INIT] Created plain source");
      }
    }

    // Create cluster layers (guarded)
    if (!mapInstance.getLayer(CLUSTER_LAYER_CIRCLES_ID)) {
      mapInstance.addLayer({
        id: CLUSTER_LAYER_CIRCLES_ID,
        type: "circle",
        source: CLUSTER_SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#51bbd6",
            10,
            "#f1f075",
            30,
            "#f28cb1",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            10,
            30,
            30,
            40,
          ],
          "circle-opacity": 0.8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    if (!mapInstance.getLayer(CLUSTER_LAYER_COUNT_ID)) {
      mapInstance.addLayer({
        id: CLUSTER_LAYER_COUNT_ID,
        type: "symbol",
        source: CLUSTER_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 14,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });
    }

    // Create plain layers (Ghost Echo) with guard (guarded)
    const circleExists = mapInstance.getLayer("spots-circle");
    const iconExists = mapInstance.getLayer("spots-icon");
    
    if (!circleExists || !iconExists) {
      setupGhostEchoLayers(
        mapInstance,
        PLAIN_SOURCE_ID,
        false, // Always pass false, filter managed separately
        perfSettings.haloBlur
      );
      if (import.meta.env.DEV) {
        console.log("[INIT] Created Ghost Echo layers");
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ROUTE PLANNER: Create route source + layers (MVP strict)
    // ═══════════════════════════════════════════════════════════════
    if (!mapInstance.getSource("route-line")) {
      mapInstance.addSource("route-line", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!mapInstance.getSource("route-waypoints")) {
      mapInstance.addSource("route-waypoints", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!mapInstance.getLayer("route-line-layer")) {
      mapInstance.addLayer({
        id: "route-line-layer",
        type: "line",
        source: "route-line",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: "none", // Hidden by default, controlled by route planner
        },
        paint: {
          "line-color": uiConfig.accentColor, // ✅ Use theme accent (no hardcode)
          "line-width": 3,
          "line-opacity": 0.7,
        },
      });
    }

    if (!mapInstance.getLayer("route-waypoints-layer")) {
      mapInstance.addLayer({
        id: "route-waypoints-layer",
        type: "circle",
        source: "route-waypoints",
        layout: {
          visibility: "none", // Hidden by default
        },
        paint: {
          "circle-radius": 8,
          "circle-color": uiConfig.accentColor, // ✅ Use theme accent
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    if (import.meta.env.DEV) {
      console.log("[INIT] Route planner layers ready");
    }

    // ═══════════════════════════════════════════════════════════════
    // 🕰️ TIME RIFT V4 STEP 4: Intelligence Overlay (Heatmap + Glow)
    // ═══════════════════════════════════════════════════════════════
    if (!mapInstance.getSource(TIME_RIFT_INTEL_SOURCE_ID)) {
      mapInstance.addSource(TIME_RIFT_INTEL_SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      if (import.meta.env.DEV) {
        console.log("[INIT] Created Time Rift Intelligence source");
      }
    }

    // Heatmap layer (visible at low zoom)
    if (!mapInstance.getLayer(TIME_RIFT_INTEL_HEATMAP_ID)) {
      mapInstance.addLayer({
        id: TIME_RIFT_INTEL_HEATMAP_ID,
        type: "heatmap",
        source: TIME_RIFT_INTEL_SOURCE_ID,
        maxzoom: 12, // Fade out at higher zoom
        layout: {
          visibility: "none", // Hidden by default, controlled by intelligence mode
        },
        paint: {
          // Heatmap weight (uniform for all spots, can be customized later)
          "heatmap-weight": 1,
          // Heatmap intensity by zoom level
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 0.5,
            9, 1.5
          ],
          // Heatmap color gradient (purple to cyan)
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(138, 43, 226, 0)", // Transparent purple
            0.2, "rgba(138, 43, 226, 0.3)",
            0.4, "rgba(75, 0, 130, 0.5)",
            0.6, "rgba(72, 118, 255, 0.7)",
            0.8, "rgba(0, 191, 255, 0.8)",
            1, "rgba(0, 255, 255, 0.9)" // Bright cyan
          ],
          // Radius of influence for each point
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 10,
            9, 30
          ],
          // Fade out heatmap as we zoom in
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7, 0.8,
            11, 0.3,
            12, 0
          ],
        },
      });
      if (import.meta.env.DEV) {
        console.log("[INIT] Created Time Rift Intelligence heatmap layer");
      }
    }

    // Glow circles layer (visible at high zoom)
    if (!mapInstance.getLayer(TIME_RIFT_INTEL_GLOW_ID)) {
      mapInstance.addLayer({
        id: TIME_RIFT_INTEL_GLOW_ID,
        type: "circle",
        source: TIME_RIFT_INTEL_SOURCE_ID,
        minzoom: 11, // Only visible at higher zoom
        layout: {
          visibility: "none", // Hidden by default
        },
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11, 8,
            16, 20
          ],
          "circle-color": "rgba(138, 43, 226, 0.4)", // Purple glow
          "circle-blur": 1.2, // Heavy blur for glow effect
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11, 0,
            12, 0.6,
            16, 0.8
          ],
        },
      });
      if (import.meta.env.DEV) {
        console.log("[INIT] Created Time Rift Intelligence glow layer");
      }
    }

    // ✅ Verify sources exist (mandatory)
    const clusterSourceExists = !!mapInstance.getSource(CLUSTER_SOURCE_ID);
    const plainSourceExists = !!mapInstance.getSource(PLAIN_SOURCE_ID);

    if (!clusterSourceExists || !plainSourceExists) {
      console.warn("[INIT] ⚠️ Sources not created, layers NOT ready");
      return; // ← Ne pas set layersReadyRef si sources manquantes
    }

    // ✅ Verify at least ONE layer of current mode exists (cluster OR plain)
    const clusterLayerExists = !!mapInstance.getLayer(CLUSTER_LAYER_CIRCLES_ID);
    const plainLayerExists = !!mapInstance.getLayer("spots-circle");
    
    const currentModeCluster = clusteringEnabledRef.current;
    const currentModeLayerExists = currentModeCluster ? clusterLayerExists : plainLayerExists;

    if (!currentModeLayerExists) {
      console.warn("[INIT] ⚠️ Current mode layer not found, layers NOT ready", {
        mode: currentModeCluster ? "CLUSTER" : "PLAIN",
        clusterLayerExists,
        plainLayerExists,
      });
      return; // ← Ne pas set layersReadyRef si layer du mode courant manquante
    }

    // ✅ FIX 2: INIT ne gère PLUS la visibilité initiale
    // La visibilité est maintenant gérée uniquement par l'effet TOGGLE (qui dépend de layersVersion)
    // Ceci permet au TOGGLE de rejouer après style.load et d'appliquer le bon état

    // ✅ Anti-race check: Only commit state if this run is still current
    if (currentRunId !== initRunIdRef.current) {
      console.warn(`[INIT] ⚠️ Run #${currentRunId} aborted before commit (superseded by #${initRunIdRef.current})`);
      return;
    }

    // ✅ CRITICAL: Mark layers as ready ONLY after confirming sources + current mode layer exist
    layersReadyRef.current = true;
    console.log(`[INIT] ✅ Layers READY (run #${currentRunId}), visibility delegated to TOGGLE`);
    
    // ✅ BÉTON: Force TOGGLE & HANDLERS to re-run immediately after init completes
    // This ensures correct visibility is applied (no "cluster visible by default")
    setLayersVersion((v) => v + 1);
  }, [mapInstance, perfSettings.haloBlur, setLayersVersion, uiConfig.accentColor]);
  // ↑ uiConfig.accentColor added to deps for route layer colors

  // ═══════════════════════════════════════════════════════════════
  // EFFECT A: INIT SOURCES + LAYERS (runs once per style load)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapInstance) return;

    // Re-initialize on style changes (sources/layers are lost)
    const handleStyleLoad = () => {
      if (import.meta.env.DEV) {
        console.log("[INIT] 🔄 Style changed, re-initializing layers");
      }
      layersReadyRef.current = false; // Mark as not ready before re-init
      initializeSpotSources();
      // ✅ NOTE: layersVersion bump is done at the end of initializeSpotSources
      // (after layersReady=true), so no need to bump here (avoids double re-run)
    };

    mapInstance.on("style.load", handleStyleLoad);

    // ✅ CRITICAL: Setup reactive fallback for missing icons (styleimagemissing event)
    // This ensures icons are added even if they're requested before ensureMapboxIcons completes
    setupStyleImageMissing(mapInstance);

    // 🔥 KICK IMMÉDIAT (le plus important) - initialize immediately if style is loaded
    initializeSpotSources();

    return () => {
      mapInstance.off("style.load", handleStyleLoad);
      // Note: styleimagemissing listener is intentionally not removed (map lifecycle managed)
    };
  }, [mapInstance, initializeSpotSources]);
  // ↑ Only map instance + rare config (NO UI toggles)

  // ═══════════════════════════════════════════════════════════════
  // EFFECT B: UPDATE DATA (updates only the active source)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapInstance) return;

    // Wait for layers to be ready before updating data
    if (!layersReadyRef.current) {
      if (import.meta.env.DEV) {
        console.log("[DATA] Waiting for layersReady");
      }
      return;
    }

    const featureCollection = {
      type: "FeatureCollection" as const,
      features: spotFeatures,
    };

    // ✅ NEW LOGIC: Update BOTH sources (pins always visible + clusters as visual aid)
    const clusterSource = mapInstance.getSource(CLUSTER_SOURCE_ID) as mapboxgl.GeoJSONSource | null;
    const plainSource = mapInstance.getSource(PLAIN_SOURCE_ID) as mapboxgl.GeoJSONSource | null;

    if (clusterSource) {
      clusterSource.setData(featureCollection);
      if (import.meta.env.DEV) {
        console.log(`[DATA] ✅ Updated ${CLUSTER_SOURCE_ID} with ${spotFeatures.length} features`);
      }
    }

    if (plainSource) {
      plainSource.setData(featureCollection);
      if (import.meta.env.DEV) {
        console.log(`[DATA] ✅ Updated ${PLAIN_SOURCE_ID} with ${spotFeatures.length} features`);
      }
    }

    if (!clusterSource && !plainSource && import.meta.env.DEV) {
      console.warn("[DATA] ⚠️ No sources found");
    }
  }, [mapInstance, spotFeatures, layersVersion]);
  // ✅ Removed clusteringEnabled from deps (update both sources always)

  // ═══════════════════════════════════════════════════════════════
  // EFFECT C: TOGGLE VISIBILITY (pure UI state, no data processing)
  // ✅ FIX 3: Dépend de layersVersion pour rejouer après style.load
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapInstance) return;

    // Wait for layers to be ready before toggling visibility
    if (!layersReadyRef.current) {
      if (import.meta.env.DEV) {
        console.log("[TOGGLE] Layers not ready yet, deferring visibility toggle");
      }
      return;
    }

    // ✅ UX RULE: Cluster = aide visuelle, pins managed by zoom
    const clusterVisibility = clusteringEnabled ? "visible" : "none";
    const plainVisibility = "visible"; // ← Pins always visible (opacity-controlled)

    // ✅ ZOOM-BASED LOGIC: When cluster ON, fade out pins at low zoom
    // This keeps the map clean at low zoom (clusters dominate)
    // Click cluster → zoom → pins fade in automatically (zoom 12+)
    const pinsOpacity = clusteringEnabled
      ? ["interpolate", ["linear"], ["zoom"], 11, 0, 12, 1] // Fade in from zoom 11 to 12
      : 1.0; // Full opacity when cluster OFF

    if (import.meta.env.DEV) {
      console.log("[TOGGLE] Applying visibility:", { 
        clusteringEnabled, 
        clusterVisibility, 
        plainVisibility, 
        pinsOpacityRule: clusteringEnabled ? "zoom 11-12 fade" : "always 1.0"
      });
    }

    // Toggle cluster layers (with getLayer guard)
    CLUSTER_LAYER_IDS.forEach((layerId) => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(layerId, "visibility", clusterVisibility);
      } else if (import.meta.env.DEV) {
        console.warn(`[TOGGLE] ⚠️ Layer '${layerId}' not found for visibility toggle`);
      }
    });

    // Apply zoom-based opacity to plain layers (with getLayer guard)
    // ✅ GARDE-FOU 1: Apply opacity to ALL pin layers uniformly (symbol icon + circle)
    PLAIN_LAYER_IDS.forEach((layerId) => {
      const layer = mapInstance.getLayer(layerId);
      if (layer) {
        mapInstance.setLayoutProperty(layerId, "visibility", plainVisibility);
        
        // ✅ Apply zoom-based opacity (fade in at close zoom when cluster ON)
        if (layer.type === "symbol") {
          mapInstance.setPaintProperty(layerId, "icon-opacity", pinsOpacity as any);
          mapInstance.setPaintProperty(layerId, "text-opacity", pinsOpacity as any);
        } else if (layer.type === "circle") {
          mapInstance.setPaintProperty(layerId, "circle-opacity", pinsOpacity as any);
          mapInstance.setPaintProperty(layerId, "circle-stroke-opacity", pinsOpacity as any);
        }
      } else if (import.meta.env.DEV) {
        console.warn(`[TOGGLE] ⚠️ Layer '${layerId}' not found for visibility toggle`);
      }
    });

    if (import.meta.env.DEV) {
      console.log(`[TOGGLE] ✅ Visibility set to: ${clusteringEnabled ? "CLUSTER+PINS (zoom-based)" : "PINS ONLY"}`);
    }
  }, [mapInstance, clusteringEnabled, layersVersion]);
  // ✅ FIX 3: layersVersion added to deps → rejoue après style.load

  // 🔍 CLUSTER: Click handler to zoom into clusters
  // Re-attaches handlers after style.load (via layersReadyRef check)
  useEffect(() => {
    if (!mapInstance) return;
    
    // Wait for layers to be ready before attaching handlers
    if (!layersReadyRef.current) {
      if (import.meta.env.DEV) {
        console.log("[CLUSTER HANDLERS] Layers not ready, deferring handler attachment");
      }
      return;
    }

    // Only attach if clustering is enabled
    if (!clusteringEnabled) {
      if (import.meta.env.DEV) {
        console.log("[CLUSTER HANDLERS] Clustering disabled, skipping handler attachment");
      }
      return;
    }

    const handleClusterClick = (e: mapboxgl.MapMouseEvent) => {
      const targetLayers = [CLUSTER_LAYER_CIRCLES_ID, CLUSTER_LAYER_COUNT_ID];
      let features = mapInstance.queryRenderedFeatures(e.point, {
        layers: targetLayers,
      });
      if (!features.length) {
        const padding = 8;
        const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
          [Math.max(e.point.x - padding, 0), Math.max(e.point.y - padding, 0)],
          [e.point.x + padding, e.point.y + padding],
        ];
        features = mapInstance.queryRenderedFeatures(bbox, {
          layers: targetLayers,
        });
      }
      
      if (!features.length) return;
      
      const clusterId = features[0].properties?.cluster_id;
      if (clusterId === undefined) return;

      const source = mapInstance.getSource(CLUSTER_SOURCE_ID) as mapboxgl.GeoJSONSource;
      if (!source) return;

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;

        const coordinates = (features[0].geometry as GeoJSON.Point).coordinates;
        mapInstance.easeTo({
          center: [coordinates[0], coordinates[1]],
          zoom: zoom ?? mapInstance.getZoom() + 2,
        });
      });
    };

    const handleClusterMouseEnter = () => {
      mapInstance.getCanvas().style.cursor = "pointer";
    };

    const handleClusterMouseLeave = () => {
      mapInstance.getCanvas().style.cursor = "";
    };

    // Verify layers exist before attaching (defensive check)
    if (!mapInstance.getLayer(CLUSTER_LAYER_CIRCLES_ID)) {
      if (import.meta.env.DEV) {
        console.warn("[CLUSTER HANDLERS] ⚠️ Cluster layer not found, cannot attach handlers");
      }
      return;
    }

    // ✅ GARDE-FOU 2: Attach handlers to BOTH cluster layers (circles + count)
    // This ensures click works on circles AND on count labels with 8px tolerance
    mapInstance.on("click", CLUSTER_LAYER_CIRCLES_ID, handleClusterClick);
    mapInstance.on("click", CLUSTER_LAYER_COUNT_ID, handleClusterClick);
    mapInstance.on("mouseenter", CLUSTER_LAYER_CIRCLES_ID, handleClusterMouseEnter);
    mapInstance.on("mouseenter", CLUSTER_LAYER_COUNT_ID, handleClusterMouseEnter);
    mapInstance.on("mouseleave", CLUSTER_LAYER_CIRCLES_ID, handleClusterMouseLeave);
    mapInstance.on("mouseleave", CLUSTER_LAYER_COUNT_ID, handleClusterMouseLeave);

    if (import.meta.env.DEV) {
      console.log("[CLUSTER HANDLERS] ✅ Attached to cluster layers (circles + count)");
    }

    return () => {
      mapInstance.off("click", CLUSTER_LAYER_CIRCLES_ID, handleClusterClick);
      mapInstance.off("click", CLUSTER_LAYER_COUNT_ID, handleClusterClick);
      mapInstance.off("mouseenter", CLUSTER_LAYER_CIRCLES_ID, handleClusterMouseEnter);
      mapInstance.off("mouseenter", CLUSTER_LAYER_COUNT_ID, handleClusterMouseEnter);
      mapInstance.off("mouseleave", CLUSTER_LAYER_CIRCLES_ID, handleClusterMouseLeave);
      mapInstance.off("mouseleave", CLUSTER_LAYER_COUNT_ID, handleClusterMouseLeave);
      if (import.meta.env.DEV) {
        console.log("[CLUSTER HANDLERS] Detached from cluster layers");
      }
    };
  }, [mapInstance, clusteringEnabled, layersVersion]);
  // ↑ layersVersion increments after style.load → forces re-binding of handlers

  // ═══════════════════════════════════════════════════════════════
  // ROUTE PLANNER: Cleanup on toggle OFF
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!routePlannerActive) {
      setRouteWaypoints([]);
      setRouteGeometry(null);
      if (import.meta.env.DEV) {
        console.log("[ROUTE] Planner disabled, cleared waypoints + geometry");
      }
    }
  }, [routePlannerActive]);

  // ═══════════════════════════════════════════════════════════════
  // ROUTE PLANNER: Fetch route geometry (debounced + abort previous + PRO ONLY)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    // ✅ PRO GATE: No fetch if non-PRO
    if (!isPro || !routePlannerActive || routeWaypoints.length < 2) {
      setRouteGeometry(null);
      return;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      fetchRouteGeometry(routeWaypoints, abortController.signal)
        .then((geometry) => {
          if (!abortController.signal.aborted) {
            setRouteGeometry(geometry);
            if (import.meta.env.DEV) {
              console.log("[ROUTE] Fetched geometry for", routeWaypoints.length, "waypoints");
            }
          }
        });
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [isPro, routePlannerActive, routeWaypoints, fetchRouteGeometry]);

  // ═══════════════════════════════════════════════════════════════
  // ROUTE PLANNER: Update map layers (route line + waypoint markers + PRO ONLY)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapInstance) return;

    const routeSource = mapInstance.getSource("route-line") as mapboxgl.GeoJSONSource;
    const waypointsSource = mapInstance.getSource("route-waypoints") as mapboxgl.GeoJSONSource;

    if (!routeSource || !waypointsSource) return;

    // ✅ PRO GATE: Clear layers if non-PRO (even if routePlannerActive)
    if (!isPro) {
      routeSource.setData({ type: "FeatureCollection", features: [] });
      waypointsSource.setData({ type: "FeatureCollection", features: [] });
      
      const routeLayer = mapInstance.getLayer("route-line-layer");
      const waypointsLayer = mapInstance.getLayer("route-waypoints-layer");
      if (routeLayer) mapInstance.setLayoutProperty("route-line-layer", "visibility", "none");
      if (waypointsLayer) mapInstance.setLayoutProperty("route-waypoints-layer", "visibility", "none");
      return;
    }

    // Update route line
    if (routeGeometry && routePlannerActive) {
      routeSource.setData({
        type: "Feature",
        geometry: routeGeometry,
        properties: {},
      });
    } else {
      routeSource.setData({ type: "FeatureCollection", features: [] });
    }

    // Update waypoint markers
    if (routePlannerActive && routeWaypoints.length > 0) {
      waypointsSource.setData({
        type: "FeatureCollection",
        features: routeWaypoints.map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: { id: p.id },
        })),
      });
    } else {
      waypointsSource.setData({ type: "FeatureCollection", features: [] });
    }

    // Toggle layer visibility
    const routeLayer = mapInstance.getLayer("route-line-layer");
    const waypointsLayer = mapInstance.getLayer("route-waypoints-layer");
    const visibility = routePlannerActive && routeWaypoints.length >= 2 ? "visible" : "none";

    if (routeLayer) {
      mapInstance.setLayoutProperty("route-line-layer", "visibility", visibility);
    }
    if (waypointsLayer) {
      mapInstance.setLayoutProperty("route-waypoints-layer", "visibility", visibility);
    }

    if (import.meta.env.DEV) {
      console.log("[ROUTE] Updated layers:", { isPro, visibility, waypointsCount: routeWaypoints.length });
    }
  }, [mapInstance, routeGeometry, routeWaypoints, routePlannerActive, isPro]);

  // ═══════════════════════════════════════════════════════════════
  // 🕰️ TIME RIFT: Apply historical overlay (MVP, no data)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapInstance || !historyActive || !isPro) {
      // Cleanup if turning OFF or non-PRO
      if (mapInstance && mapInstance.getLayer("history-decay-layer")) {
        mapInstance.setLayoutProperty("history-decay-layer", "visibility", "none");
        const source = mapInstance.getSource("history-decay") as mapboxgl.GeoJSONSource | undefined;
        if (source) {
          source.setData({ type: "FeatureCollection", features: [] });
        }
        if (import.meta.env.DEV) console.log("[HISTORY] Cleanup: hidden decay layer");
      }
      return;
    }

    // MODE: DECAY — fake heatmap using existing spots (memoized GeoJSON)
    if (historyMode === "decay") {
      // Ensure source exists
      if (!mapInstance.getSource("history-decay")) {
        mapInstance.addSource("history-decay", {
          type: "geojson",
          data: decayGeoJSON,
        });
      } else {
        // Update source with memoized GeoJSON (only rebuilds when places change)
        const source = mapInstance.getSource("history-decay") as mapboxgl.GeoJSONSource;
        source.setData(decayGeoJSON);
      }

      // Ensure layer exists
      if (!mapInstance.getLayer("history-decay-layer")) {
        mapInstance.addLayer({
          id: "history-decay-layer",
          type: "circle",
          source: "history-decay",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 8, 15, 20, 18, 30],
            "circle-color": uiConfig.accentColor || "#A356FF",
            "circle-opacity": 0.12,
            "circle-blur": 0.8,
          },
        });
      }

      mapInstance.setLayoutProperty("history-decay-layer", "visibility", "visible");
      
      if (import.meta.env.DEV) {
        console.log("[HISTORY] DECAY mode ON: fake heatmap with", places.length, "spots");
      }
    } else {
      // Hide decay layer if not in decay mode + clear source
      if (mapInstance.getLayer("history-decay-layer")) {
        mapInstance.setLayoutProperty("history-decay-layer", "visibility", "none");
      }
      const source = mapInstance.getSource("history-decay") as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    }

    // MODE: ARCHIVES & THEN-NOW — apply desaturation/contrast via paint props
    // (MVP: minimal visual change, no heavy manipulation)
    // TODO: Future enhancement - store/restore original paint props if needed

    if (import.meta.env.DEV) {
      console.log("[HISTORY] Mode:", historyMode, "Year:", historyYear);
    }
  }, [mapInstance, historyActive, historyMode, historyYear, isPro, decayGeoJSON, places.length, uiConfig.accentColor]);

  // ═══════════════════════════════════════════════════════════════
  // 🕰️ TIME RIFT V4 STEP 4: Intelligence Overlay (Heatmap + Glow)
  // Updates overlay data based on intelligence mode + era filter
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mapInstance) return;

    // Wait for layers to be ready
    if (!layersReadyRef.current) {
      if (import.meta.env.DEV) {
        console.log("[TIME RIFT INTEL] Layers not ready, deferring");
      }
      return;
    }

    const intelSource = mapInstance.getSource(TIME_RIFT_INTEL_SOURCE_ID) as mapboxgl.GeoJSONSource | null;
    if (!intelSource) {
      if (import.meta.env.DEV) {
        console.warn("[TIME RIFT INTEL] Source not found");
      }
      return;
    }

    // Check feature flag
    const intelEnabled = isIntelligenceModeEnabled();
    const shouldShowOverlay = intelEnabled && historyMode === "intelligence" && historyActive && isPro;

    if (import.meta.env.DEV) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🕰️ TIME RIFT INTEL - OVERLAY UPDATE");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔧 intelEnabled:", intelEnabled);
      console.log("📊 historyMode:", historyMode);
      console.log("✅ historyActive:", historyActive);
      console.log("👑 isPro:", isPro);
      console.log("🎯 shouldShowOverlay:", shouldShowOverlay);
      console.log("🌍 timeRiftEra:", timeRiftEra);
      console.log("📍 Total places:", places.length);
    }

    if (!shouldShowOverlay) {
      // Hide overlay + clear data
      intelSource.setData({ type: "FeatureCollection", features: [] });
      
      [TIME_RIFT_INTEL_HEATMAP_ID, TIME_RIFT_INTEL_GLOW_ID].forEach(layerId => {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.setLayoutProperty(layerId, "visibility", "none");
        }
      });

      if (import.meta.env.DEV) {
        console.log("❌ Overlay hidden:", {
          reason: !intelEnabled ? "flag OFF" : !historyActive ? "history OFF" : historyMode !== "intelligence" ? "wrong mode" : "not PRO"
        });
      }
      return;
    }

    // Generate filtered GeoJSON
    const intelSpots = _filterSpotsByBucket(places, timeRiftEra);
    const intelGeo = spotsToGeoJSON(intelSpots);

    if (import.meta.env.DEV) {
      console.log("📊 Filtered spots:", intelSpots.length, "/", places.length);
      console.log("📊 GeoJSON features:", intelGeo.features.length);
      
      // Sample first 3 spots to see if they have year data
      if (intelSpots.length > 0) {
        console.log("📊 Sample spots (first 3):");
        intelSpots.slice(0, 3).forEach(spot => {
          const year = getSpotYear(spot);
          console.log("  -", spot.title, "| Year:", year || "unknown");
        });
      } else {
        console.warn("⚠️ NO SPOTS after filter! Check getSpotYear() implementation");
      }
    }

    // Update source
    intelSource.setData(intelGeo);

    // Show overlay layers
    [TIME_RIFT_INTEL_HEATMAP_ID, TIME_RIFT_INTEL_GLOW_ID].forEach(layerId => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(layerId, "visibility", "visible");
      }
    });

    if (import.meta.env.DEV) {
      console.log("✅ OVERLAY VISIBLE:", intelSpots.length, "spots (era:", timeRiftEra, ")");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
  }, [mapInstance, historyMode, historyActive, isPro, timeRiftEra, places, layersVersion]);
  // ↑ layersVersion ensures re-run after style.load

  // 🕰️ TIME RIFT HARD OFF (centralized cleanup)
  // ═══════════════════════════════════════════════════════════════
  // All exit paths MUST use this function:
  // - Re-click button toggle OFF
  // - × close button
  // - Non-PRO force OFF useEffect
  const hardOffHistory = useCallback(() => {
    setHistoryActive(false);

    // 🕰️ V4: Reset intelligence state aussi
    setTimeRiftEra("all");
    setTimeRiftOverlayEnabled(false);

    // Fail-safe Mapbox cleanup (if layers/sources exist)
    if (mapInstance) {
      // Cleanup decay layer
      if (mapInstance.getLayer("history-decay-layer")) {
        mapInstance.setLayoutProperty("history-decay-layer", "visibility", "none");
      }
      const source = mapInstance.getSource("history-decay") as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }

      // 🕰️ V4: Cleanup intelligence overlay
      [TIME_RIFT_INTEL_HEATMAP_ID, TIME_RIFT_INTEL_GLOW_ID].forEach(layerId => {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.setLayoutProperty(layerId, "visibility", "none");
        }
      });
      const intelSource = mapInstance.getSource(TIME_RIFT_INTEL_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (intelSource) {
        intelSource.setData({ type: "FeatureCollection", features: [] });
      }
    }

    if (import.meta.env.DEV) {
      console.log("[HISTORY][HARD OFF] Cleanup complete");
    }
  }, [mapInstance]);

  // 🕰️ TIME RIFT V4: Era Change Handler
  const handleEraChange = useCallback((era: EraBucket) => {
    setTimeRiftEra(era);
    
    if (import.meta.env.DEV) {
      console.log("[TIME RIFT][ERA] Changed to", era);
    }
  }, []);

  // 🕰️ TIME RIFT TOGGLE (PRO only)
  // ═══════════════════════════════════════════════════════════════
  // Anti-double-fire lock (prevent duplicate calls within same frame)
  const historyToggleLockRef = useRef(false);

  const handleHistoryToggle = useCallback(() => {
    // Anti-double-fire: lock for 1 microtask
    if (historyToggleLockRef.current) {
      if (import.meta.env.DEV) console.warn("[HISTORY][TOGGLE] Blocked duplicate call (lock active)");
      return;
    }
    historyToggleLockRef.current = true;
    queueMicrotask(() => {
      historyToggleLockRef.current = false;
    });

    // Guard: force OFF if non-PRO (shouldn't happen, but safe)
    if (!isPro) {
      hardOffHistory();
      return;
    }

    // ✅ BULLET-PROOF: Functional setState (same pattern as ROUTE)
    setHistoryActive((prev) => {
      const next = !prev;

      if (import.meta.env.DEV) {
        console.log("[HISTORY][TOGGLE] prev->next", { prev, next });
      }

      // If toggling OFF, use centralized cleanup
      if (!next) {
        // Schedule cleanup AFTER state update (next tick)
        setTimeout(() => hardOffHistory(), 0);
      }

      return next;
    });
  }, [isPro, hardOffHistory]);

  // Force OFF if non-PRO (use centralized cleanup)
  useEffect(() => {
    if (!isPro && historyActive) {
      hardOffHistory();
      if (import.meta.env.DEV) console.log("[HISTORY] Forced OFF (non-PRO guard)");
    }
  }, [isPro, historyActive, hardOffHistory]);

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

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setDropCoords(null);
  }, []);

  const handleSpotSubmit = useCallback(
    async (payload: SpotFormPayload) => {
      if (!dropCoords) {
        const missingCoordsError = new Error("Coordonnées manquantes");
        toast.error("Coordonnées manquantes");
        throw missingCoordsError;
      }
      const coords = { lat: dropCoords.lat, lng: dropCoords.lng };
      const coordsError = validateLatLng(coords.lat, coords.lng);
      if (coordsError) {
        toast.error(coordsError);
        throw new Error(coordsError);
      }
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
        const docId = await submitSpotSubmission({
          title: payload.title,
          descriptionShort: payload.description,
          descriptionFull: payload.description,
          coordinates: coords,
          category: payload.category,
          riskLevel: payload.riskLevel,
          access: payload.access,
          isPublic: true,
          photos: payload.photos,
          notesForAdmin: payload.accessNotes,
          createdByUserId: user?.uid ?? undefined,
          createdByDisplayName: user?.displayName ?? undefined,
          createdByEmail: user?.email ?? undefined,
          source: role === "pro" ? "pro" : role === "member" ? "member" : "guest",
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
        toast.success("Spot soumis pour validation ! Un admin l'approuvera bientôt. 🎯");
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
        toast.error(
          `Erreur lors de l’ajout${code ? ` (${code})` : ""}: ${message}`
        );
        throw error;
      }
    },
    [dropCoords, mapInstance, toast, user?.uid]
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

  // ═══════════════════════════════════════════════════════════════
  // ROUTE PLANNER: HARD OFF handler (fail-safe toggle)
  // ═══════════════════════════════════════════════════════════════
  // ✅ BULLET-PROOF TOGGLE: Use functional setState to avoid stale closure
  const handleRouteToggle = useCallback(() => {
    setRoutePlannerActive((prev) => {
      const next = !prev;

      // DEV trace
      if (import.meta.env.DEV) {
        console.log("[ROUTE][TOGGLE] prev->next", { prev, next });
      }

      // If turning OFF: do HARD OFF immediately (do not rely on effects)
      if (prev === true && next === false) {
        // Sync refs immediately to avoid edge window
        routePlannerActiveRef.current = false;

        // Clear state now
        setRouteWaypoints([]);
        setRouteGeometry(null);

        // Fail-safe: hide layers + clear sources
        if (mapInstance) {
          try {
            if (mapInstance.getLayer("route-line-layer")) {
              mapInstance.setLayoutProperty("route-line-layer", "visibility", "none");
            }
            if (mapInstance.getLayer("route-waypoints-layer")) {
              mapInstance.setLayoutProperty("route-waypoints-layer", "visibility", "none");
            }

            const routeSource = mapInstance.getSource("route-line") as mapboxgl.GeoJSONSource | undefined;
            const wpSource = mapInstance.getSource("route-waypoints") as mapboxgl.GeoJSONSource | undefined;

            routeSource?.setData({ type: "FeatureCollection", features: [] } as any);
            wpSource?.setData({ type: "FeatureCollection", features: [] } as any);
          } catch (e) {
            if (import.meta.env.DEV) console.warn("[ROUTE] HARD OFF mapbox cleanup failed", e);
          }
        }

        if (import.meta.env.DEV) {
          console.log("[ROUTE] HARD OFF done");
        }
      }

      // If turning ON: sync ref immediately too (optional but consistent)
      if (prev === false && next === true) {
        routePlannerActiveRef.current = true;
        if (import.meta.env.DEV) console.log("[ROUTE] Toggle ON");
      }

      return next;
    });
  }, [routePlannerActive, mapInstance]);

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
                {/* Options Map PRO - gauche */}
                {showProFilters && (
                  <div className="map-pro-bar-options">
                    <MapProPanel
                      styleValue={mapStyle}
                      onStyleChange={handleStyleChange}
                      epicFilterActive={epicFilterActive}
                      ghostFilterActive={ghostFilterActive}
                      onEpicToggle={handleEpicToggle}
                      onGhostToggle={handleGhostToggle}
                      isProUser={isPro}
                      onUpgradeRequired={() => {
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("urbex-nav", { detail: { path: "/pro?src=route" } })
                          );
                        }
                      }}
                      clusteringEnabled={clusteringEnabled}
                      routePlannerActive={routePlannerActive}
                      historyActive={historyActive}
                      advancedFiltersActive={advancedFiltersActive}
                      onClusterToggle={handleClusterToggle}
                      onRouteToggle={handleRouteToggle}
                      onRouteClear={() => {
                        setRouteWaypoints([]);
                        setRouteGeometry(null);
                        if (import.meta.env.DEV) {
                          console.log("[ROUTE] Cleared via Clear button");
                        }
                      }}
                      onHistoryToggle={handleHistoryToggle}
                      onFiltersToggle={() => setAdvancedFiltersActive((prev) => !prev)}
                    />
                  </div>
                )}
                
                {/* Bouton PRO Dashboard - droite */}
                <div className="map-pro-bar-actions">
                  <button
                    type="button"
                    className="map-pro-bar-dashboard"
                    onClick={handleOpenProDashboard}
                    title="Ouvrir PRO Dashboard"
                  >
                    🎮 PRO
                  </button>

                  {!isPro && (
                    <button
                      type="button"
                      className={`map-pro-bar-unlock${proUnlockPulseActive ? " is-pulsing" : ""}`}
                      onClick={handleUnlockPro}
                    >
                      👑 Débloquer PRO
                    </button>
                  )}
                </div>
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
      showProFilters,
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
    <div className={`route-map ${historyActive ? `time-rift-active time-rift-mode--${historyMode}` : ""}`}>
      <div className="map-shell">
        {mapReady && (
          <div
            className="map-ready-marker"
            data-testid="map-ready"
            data-state="ready"
            aria-hidden="true"
          />
        )}
        <div className="map-canvas" data-testid="map-canvas">
          <MapView
            nightVisionActive={nightVisionActive}
            styleUrl={STYLE_URLS[mapStyle]}
            onMapReady={handleMapReady}
          />
        </div>
        <div className="map-overlay">
          {/* ═══════════════════════════════════════════════════════════════
              ROUTE PLANNER: UX Toast (fail-safe guide)
              ═══════════════════════════════════════════════════════════════ */}
          {showRouteToast && (
            <div
              style={{
                position: "absolute",
                top: "80px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 9999,
                background: "rgba(0, 0, 0, 0.85)",
                color: "white",
                padding: "12px 20px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                pointerEvents: "none",
                animation: "fadeIn 0.3s ease-in-out",
              }}
            >
              📍 Sélectionne 2 spots pour tracer l'itinéraire
            </div>
          )}
          
          {/* ═══════════════════════════════════════════════════════════════
              🕰️ TIME RIFT PANEL (PRO, no data MVP)
              ═══════════════════════════════════════════════════════════════ */}
          <TimeRiftPanel
            active={historyActive}
            mode={historyMode}
            year={historyYear}
            onModeChange={setHistoryMode}
            onYearChange={setHistoryYear}
            onClose={hardOffHistory}
            // V4 NEW: Intelligence mode props
            era={timeRiftEra}
            onEraChange={handleEraChange}
            showIntelligenceMode={isIntelligenceModeEnabled() && isPro}
            isPro={isPro}
          />
          
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
            userRole={role}
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
        {DEBUG_FETCH_STATS_ENABLED && (
          <div className="map-fetch-stats">
            <div className="map-fetch-stats__row">
              <span>Tiles</span>
              <strong>{debugFetchStats.fetchedTiles}</strong>
            </div>
            <div className="map-fetch-stats__row">
              <span>Docs</span>
              <strong>{debugFetchStats.fetchedDocs}</strong>
            </div>
            <div className="map-fetch-stats__row">
              <span>In flight</span>
              <strong>{debugFetchStats.inFlight}</strong>
            </div>
            <div className="map-fetch-stats__row">
              <span>Last query</span>
              <strong>{debugFetchStats.lastQueryMs}ms</strong>
            </div>
          </div>
        )}
        {perfSettings.performanceHUDEnabled && <PerformanceHUD metrics={perfMetrics} />}
        {(import.meta.env.DEV || perfSettings.performanceHUDEnabled) && <PerformanceControls />}
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
              data-testid="spot-popup"
            >
              <div className="uq-spot-popup-card">
                <button
                  type="button"
                  className="map-spot-popup-close uq-spot-popup-close"
                  onClick={closeSpotPopup}
                  aria-label="Fermer l’information du spot"
                  title="Fermer l’information du spot"
                >
                  ×
                </button>
                {selectedSpot ? (
                  <>
                    {selectedSpot.historyImages &&
                    selectedSpot.historyImages.length > 0 ? (
                      <div className="uq-spot-popup-media">
                        <UQImage
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
                        <div className="uq-spot-popup-header-content">
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
                            </div>
                            <p className="uq-spot-popup-category">
                              {selectedSpot.category ?? "Autre"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="map-spot-popup-reanchor"
                          aria-label="Replacer le popup sur le pin"
                          title="Replacer le popup sur le pin"
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
                          🎯 Fiche
                        </button>
                        <button
                          type="button"
                          className="uq-spot-popup-btn uq-spot-popup-btn--secondary"
                          onClick={handleItinerary}
                        >
                          🗺️ Itinéraire
                        </button>
                        <button
                          type="button"
                          className={`uq-spot-popup-btn uq-spot-popup-btn--done${
                            spotMarkedDone ? " is-active" : ""
                          }${donePulseActive ? " is-pulsing" : ""}${
                            pendingSpotAction === "done" ? " is-pending" : ""
                          }`}
                          onClick={handleToggleDone}
                          disabled={pendingSpotAction === "done"}
                        >
                          {spotMarkedDone ? "✅ Spot fait" : "✅ Marquer fait"}
                        </button>
                        <button
                          type="button"
                          className={`uq-spot-popup-btn uq-spot-popup-btn--saved${
                            spotSaved ? " is-active" : ""
                          }${savedPulseActive ? " is-pulsing" : ""}${
                            pendingSpotAction === "saved" ? " is-pending" : ""
                          }`}
                          onClick={handleToggleSaved}
                          disabled={pendingSpotAction === "saved"}
                        >
                          {spotSaved ? "💗 Sauvegardé" : "💗 Sauvegarder"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <SpotPopupSkeleton />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Welcome Banner pour utilisateurs non-inscrits */}
      {isGuest && (
        <WelcomeBanner 
          onSignup={handleWelcomeSignup} 
          onLogin={handleWelcomeLogin} 
        />
      )}

      {/* Modal PRO */}
      <ProModal open={proModalOpen} onClose={() => setProModalOpen(false)} />

      {/* PRO Dashboard Panel */}
      <ProDashboardPanel
        isOpen={proDashboardOpen}
        onClose={handleCloseProDashboard}
        isPro={isPro}
        onUnlockPro={handleUnlockPro}
        nightVisionActive={nightVisionActive}
        onToggleNightVision={undefined} // TODO: connecter au parent
      />

      <GuestLimitModalManager
        userLevel={userLevel}
        requireAuth={requireAuth}
        spotsVisible={places.length}
        totalSpots={100} // Placeholder - sera dynamique
      />

      {/* Spot Lists Modal - Spots faits & favoris */}
      <SpotListsModal
        open={spotListsOpen}
        view={spotListsView}
        places={places}
        userPlaces={optimisticUserPlaces}
        onClose={handleSpotListsClose}
        onViewChange={handleSpotListsViewChange}
        onSelectPlace={handleSelectPlaceFromList}
        onToggleDone={handleToggleDoneFromList}
        onToggleSaved={handleToggleSavedFromList}
      />
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
