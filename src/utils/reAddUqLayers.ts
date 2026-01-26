import type { Map } from "mapbox-gl";
import { setupGhostEchoLayers } from "../examples/markerIntegration";
import { ensureMapboxIcons } from "./mapboxIcons";

// Source IDs
export const CLUSTER_SOURCE_ID = "spots-source";
export const PLAIN_SOURCE_ID = "spots-source-plain";
export const TIME_RIFT_INTEL_SOURCE_ID = "time-rift-intel-source";

// Layer IDs
export const CLUSTER_LAYER_CIRCLES_ID = "clusters";
export const CLUSTER_LAYER_COUNT_ID = "cluster-count";
export const TIME_RIFT_INTEL_HEATMAP_ID = "time-rift-intel-heatmap";
export const TIME_RIFT_INTEL_GLOW_ID = "time-rift-intel-glow";

interface ReAddLayersOptions {
  /** Accent color for route layers */
  accentColor?: string;
  /** Halo blur amount for Ghost Echo layers */
  haloBlur?: number;
  /** Skip icon loading (already done) */
  skipIcons?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Re-add all UrbexQueens custom layers after a style change
 * 
 * ✅ IDEMPOTENT: Safe to call multiple times (guards with getSource/getLayer)
 * ✅ Ensures sources + layers exist in correct order
 * ✅ Preserves layer paint/layout properties
 * 
 * Called after:
 * - Initial map load
 * - Style change (Night ↔ Satellite)
 * - Any map.setStyle() that resets layers
 * 
 * @param map - Mapbox map instance
 * @param opts - Configuration options
 */
export async function reAddUqLayers(
  map: Map,
  opts: ReAddLayersOptions = {}
): Promise<void> {
  const {
    accentColor = "#B8FDFF",
    haloBlur = 0,
    skipIcons = false,
    verbose = import.meta.env.DEV,
  } = opts;

  if (verbose) {
    console.log("[LAYERS] 🔧 Re-adding UrbexQueens custom layers...");
  }

  // ═══════════════════════════════════════════════════════════════
  // ICONS: Ensure Mapbox icons are loaded BEFORE creating layers
  // 🎯 FIRE-AND-FORGET: Non-blocking, styleimagemissing handles JIT
  // ═══════════════════════════════════════════════════════════════
  if (!skipIcons) {
    // Fire-and-forget: don't await, let styleimagemissing handle missing icons
    ensureMapboxIcons(map, { verbose }).catch((error) => {
      console.error("[LAYERS] ❌ Failed to load icons (non-blocking):", error);
    });
  }

  const emptyFeatureCollection = {
    type: "FeatureCollection" as const,
    features: [],
  };

  // ═══════════════════════════════════════════════════════════════
  // SOURCES: Cluster + Plain
  // ═══════════════════════════════════════════════════════════════
  if (!map.getSource(CLUSTER_SOURCE_ID)) {
    map.addSource(CLUSTER_SOURCE_ID, {
      type: "geojson",
      data: emptyFeatureCollection,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });
    if (verbose) {
      console.log("[LAYERS] ➕ Created cluster source");
    }
  }

  if (!map.getSource(PLAIN_SOURCE_ID)) {
    map.addSource(PLAIN_SOURCE_ID, {
      type: "geojson",
      data: emptyFeatureCollection,
      cluster: false,
    });
    if (verbose) {
      console.log("[LAYERS] ➕ Created plain source");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYERS: Cluster (circles + count)
  // ═══════════════════════════════════════════════════════════════
  if (!map.getLayer(CLUSTER_LAYER_CIRCLES_ID)) {
    map.addLayer({
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
    if (verbose) {
      console.log("[LAYERS] ➕ Created cluster circles layer");
    }
  }

  if (!map.getLayer(CLUSTER_LAYER_COUNT_ID)) {
    map.addLayer({
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
    if (verbose) {
      console.log("[LAYERS] ➕ Created cluster count layer");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYERS: Ghost Echo (plain spots with icon + circle)
  // ═══════════════════════════════════════════════════════════════
  const circleExists = map.getLayer("spots-circle");
  const iconExists = map.getLayer("spots-icon");

  if (!circleExists || !iconExists) {
    setupGhostEchoLayers(
      map,
      PLAIN_SOURCE_ID,
      false, // Always pass false, filter managed separately
      haloBlur
    );
    if (verbose) {
      console.log("[LAYERS] ➕ Created Ghost Echo layers");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ROUTE PLANNER: Source + Layers
  // ═══════════════════════════════════════════════════════════════
  if (!map.getSource("route-line")) {
    map.addSource("route-line", {
      type: "geojson",
      data: emptyFeatureCollection,
    });
  }

  if (!map.getSource("route-waypoints")) {
    map.addSource("route-waypoints", {
      type: "geojson",
      data: emptyFeatureCollection,
    });
  }

  if (!map.getLayer("route-line-layer")) {
    map.addLayer({
      id: "route-line-layer",
      type: "line",
      source: "route-line",
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: "none",
      },
      paint: {
        "line-color": accentColor,
        "line-width": 3,
        "line-opacity": 0.7,
      },
    });
  }

  if (!map.getLayer("route-waypoints-layer")) {
    map.addLayer({
      id: "route-waypoints-layer",
      type: "circle",
      source: "route-waypoints",
      layout: {
        visibility: "none",
      },
      paint: {
        "circle-radius": 8,
        "circle-color": accentColor,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TIME RIFT: Intelligence Overlay (Heatmap + Glow)
  // ═══════════════════════════════════════════════════════════════
  if (!map.getSource(TIME_RIFT_INTEL_SOURCE_ID)) {
    map.addSource(TIME_RIFT_INTEL_SOURCE_ID, {
      type: "geojson",
      data: emptyFeatureCollection,
    });
    if (verbose) {
      console.log("[LAYERS] ➕ Created Time Rift Intelligence source");
    }
  }

  if (!map.getLayer(TIME_RIFT_INTEL_HEATMAP_ID)) {
    map.addLayer({
      id: TIME_RIFT_INTEL_HEATMAP_ID,
      type: "heatmap",
      source: TIME_RIFT_INTEL_SOURCE_ID,
      maxzoom: 12,
      layout: {
        visibility: "none",
      },
      paint: {
        "heatmap-weight": 1,
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 0.5,
          9, 1.5,
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(33, 102, 172, 0)",
          0.2, "rgb(103, 169, 207)",
          0.4, "rgb(209, 229, 240)",
          0.6, "rgb(253, 219, 199)",
          0.8, "rgb(239, 138, 98)",
          1, "rgb(178, 24, 43)",
        ],
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 2,
          9, 20,
        ],
        "heatmap-opacity": 0.8,
      },
    });
  }

  if (!map.getLayer(TIME_RIFT_INTEL_GLOW_ID)) {
    map.addLayer({
      id: TIME_RIFT_INTEL_GLOW_ID,
      type: "circle",
      source: TIME_RIFT_INTEL_SOURCE_ID,
      minzoom: 12,
      layout: {
        visibility: "none",
      },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12, 4,
          16, 12,
        ],
        "circle-color": "#B8FDFF",
        "circle-opacity": 0.6,
        "circle-blur": 1,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 👻 GHOST ECHO: Lite (cosmetic) + Intel (heatmap) layers
  // CRITICAL: Must be recreated after style change (Night ↔ Satellite)
  // ═══════════════════════════════════════════════════════════════
  if (!map.getSource("ghost-echo-source")) {
    map.addSource("ghost-echo-source", {
      type: "geojson",
      data: emptyFeatureCollection,
    });
    if (verbose) {
      console.log("[LAYERS] ➕ Created Ghost Echo source");
    }
  }

  // Ghost Echo Lite: Circle layer with glow (cosmetic, Guest/Free accessible)
  if (!map.getLayer("ghost-echo-lite-layer")) {
    map.addLayer({
      id: "ghost-echo-lite-layer",
      type: "circle",
      source: "ghost-echo-source",
      layout: {
        visibility: "none",
      },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8, 6,
          12, 12,
          16, 20
        ],
        "circle-color": "rgba(138, 43, 226, 0.2)", // Violet UrbexQueens
        "circle-blur": 1.5,
        "circle-opacity": 0.25,
        "circle-stroke-width": 1,
        "circle-stroke-color": "rgba(0, 191, 255, 0.3)", // Cyan hint
        "circle-stroke-opacity": 0.4,
      },
    });
    if (verbose) {
      console.log("[LAYERS] ➕ Created Ghost Echo Lite layer (cosmetic)");
    }
  }

  // Ghost Echo Intel: Heatmap layer (Pro-only, exploitable patterns)
  if (!map.getLayer("ghost-echo-intel-heatmap")) {
    map.addLayer({
      id: "ghost-echo-intel-heatmap",
      type: "heatmap",
      source: "ghost-echo-source",
      maxzoom: 13,
      layout: {
        visibility: "none",
      },
      paint: {
        "heatmap-weight": ["coalesce", ["get", "decayScore"], 1], // ✅ Data-driven weight
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 0.6,
          9, 1.8
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(33, 102, 172, 0)",
          0.2, "rgba(33, 102, 172, 0.4)",
          0.4, "rgba(103, 58, 183, 0.6)",
          0.6, "rgba(142, 36, 170, 0.7)",
          0.8, "rgba(213, 62, 79, 0.8)",
          1, "rgba(244, 109, 67, 0.9)"
        ],
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 12,
          9, 35
        ],
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7, 0.7,
          11, 0.4,
          13, 0
        ],
      },
    });
    if (verbose) {
      console.log("[LAYERS] ➕ Created Ghost Echo Intel heatmap (Pro-only)");
    }
  }

  // Ghost Echo Intel Glow: Circle overlay at high zoom (Pro-only)
  if (!map.getLayer("ghost-echo-intel-glow")) {
    map.addLayer({
      id: "ghost-echo-intel-glow",
      type: "circle",
      source: "ghost-echo-source",
      minzoom: 12,
      layout: {
        visibility: "none",
      },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12, 10,
          16, 25
        ],
        "circle-color": "rgba(142, 36, 170, 0.5)", // Deep purple
        "circle-blur": 1.8,
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12, 0,
          13, 0.5,
          16, 0.7
        ],
      },
    });
    if (verbose) {
      console.log("[LAYERS] ➕ Created Ghost Echo Intel glow (Pro-only)");
    }
  }

  if (verbose) {
    console.log("[LAYERS] ✅ All UrbexQueens layers ready");
  }
}
